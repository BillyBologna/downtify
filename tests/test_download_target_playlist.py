"""Downloads that land straight in one of the user's own playlists."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import pytest
from fastapi import HTTPException
from mutagen.id3 import ID3, TIT2, TPE1

from downtify import api
from downtify.library_catalog import LibraryContext
from downtify.manual_playlists import create_manual_playlist
from downtify.playlist_listing import list_library_playlists

KEY = api.TARGET_PLAYLIST_KEY


def _mp3(path: Path, title: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tags = ID3()
    tags.add(TIT2(encoding=3, text=title))
    tags.add(TPE1(encoding=3, text='Eminem'))
    tags.save(str(path), v2_version=3)


@dataclass
class Library:
    ctx: LibraryContext
    announced: list[str] = field(default_factory=list)

    @property
    def download_dir(self) -> Path:
        return self.ctx.download_dir


@pytest.fixture
def library(tmp_path, monkeypatch):
    download = tmp_path / 'downloads'
    download.mkdir()
    ctx = LibraryContext(download_dir=download)
    monkeypatch.setattr(api, 'library_context', lambda: ctx)
    found = Library(ctx)

    async def announce() -> None:
        found.announced.append('playlists_changed')

    monkeypatch.setattr(api, 'announce_playlists_changed', announce)
    monkeypatch.setattr(api, 'invalidate_library_paths_cache', lambda: None)
    create_manual_playlist(ctx, 'Gym')
    return found


def _files(library: Library, name: str = 'Gym') -> list[str]:
    listed = list_library_playlists(library.download_dir)
    return next(item for item in listed if item['name'] == name)['files']


def _entry(**values: Any):
    entry = {'name': 'Gym', 'manual': True, 'mine': True}
    entry.update(values)
    return lambda name, request, **_: entry


def test_target_must_be_a_playlist_the_caller_can_edit(monkeypatch):
    monkeypatch.setattr(api, 'require_playlist_visible', _entry())
    assert api._checked_target_playlist(' Gym ', None) == 'Gym'
    assert not api._checked_target_playlist('', None)
    assert not api._checked_target_playlist(None, None)

    monkeypatch.setattr(api, 'require_playlist_visible', _entry(manual=False))
    with pytest.raises(HTTPException) as imported:
        api._checked_target_playlist('Gym', None)
    assert imported.value.status_code == 403

    monkeypatch.setattr(
        api,
        'require_playlist_visible',
        _entry(mine=False, can_edit_tracks=False),
    )
    with pytest.raises(HTTPException) as view_only:
        api._checked_target_playlist('Gym', None)
    assert view_only.value.status_code == 403

    monkeypatch.setattr(
        api,
        'require_playlist_visible',
        _entry(mine=False, can_edit_tracks=True),
    )
    assert api._checked_target_playlist('Gym', None) == 'Gym'


def test_unknown_playlist_fails_the_request_before_queueing(monkeypatch):
    def missing(name, request, **_):
        raise HTTPException(status_code=404, detail='Playlist not found')

    monkeypatch.setattr(api, 'require_playlist_visible', missing)
    songs = [{'song_id': 'a', KEY: 'Deleted'}]
    with pytest.raises(HTTPException) as caught:
        api._apply_target_playlist(songs, None)
    assert caught.value.status_code == 404


def test_apply_target_checks_each_name_once_and_drops_blank_hints(
    monkeypatch,
):
    seen: list[str] = []

    def entry(name, request, **_):
        seen.append(name)
        return {'name': name, 'manual': True, 'mine': True}

    monkeypatch.setattr(api, 'require_playlist_visible', entry)
    songs = [
        {'song_id': 'a', KEY: 'Gym'},
        {'song_id': 'b', KEY: 'Gym'},
        {'song_id': 'c', KEY: '  '},
        {'song_id': 'd'},
        'not a song',
    ]
    api._apply_target_playlist(songs, None)
    assert seen == ['Gym']
    assert songs[0][KEY] == songs[1][KEY] == 'Gym'
    assert KEY not in songs[2]
    assert KEY not in songs[3]


def test_a_single_download_lands_in_its_playlist(library, monkeypatch):
    _mp3(library.download_dir / 'One.mp3', 'One')

    async def core(song, song_id, *args, **kwargs):
        return 'One.mp3'

    monkeypatch.setattr(api, '_run_download_core', core)
    song = {'song_id': 's1', KEY: 'Gym'}
    filename = asyncio.run(api._run_download(song, 's1'))
    assert filename == 'One.mp3'
    assert _files(library) == ['One.mp3']
    assert library.announced == ['playlists_changed']


def test_a_download_without_a_target_touches_no_playlist(library, monkeypatch):
    _mp3(library.download_dir / 'One.mp3', 'One')

    async def core(song, song_id, *args, **kwargs):
        return 'One.mp3'

    monkeypatch.setattr(api, '_run_download_core', core)
    asyncio.run(api._run_download({'song_id': 's1'}, 's1'))
    asyncio.run(
        api._run_download(
            {'song_id': 's2', KEY: 'Gym'}, 's2', add_to_target=False
        )
    )
    assert _files(library) == []
    assert library.announced == []


def test_a_failed_download_adds_nothing(library, monkeypatch):
    async def core(song, song_id, *args, **kwargs):
        return None

    monkeypatch.setattr(api, '_run_download_core', core)
    asyncio.run(api._run_download({'song_id': 's1', KEY: 'Gym'}, 's1'))
    assert _files(library) == []


def test_a_playlist_that_vanished_never_fails_the_download(
    library, monkeypatch
):
    _mp3(library.download_dir / 'One.mp3', 'One')

    async def core(song, song_id, *args, **kwargs):
        return 'One.mp3'

    monkeypatch.setattr(api, '_run_download_core', core)
    song = {'song_id': 's1', KEY: 'Renamed away'}
    assert asyncio.run(api._run_download(song, 's1')) == 'One.mp3'
    assert library.announced == []


def test_album_batch_fills_the_playlist_in_track_order(library, monkeypatch):
    names = [f'{n:02d} Song.mp3' for n in range(1, 5)]
    for number, name in enumerate(names, 1):
        _mp3(library.download_dir / name, f'Song {number}')
        songs = [
            {
                'song_id': f't{number}',
                'name': f'Song {number}',
                'downtify_track_order': number - 1,
                KEY: 'Gym',
            }
            for number in range(1, 5)
        ]
    # Tracks finish 3, 1, 4, 2: the playlist must still read 1, 2, 3, 4.
    finish_after = {'t3': 0.00, 't1': 0.03, 't4': 0.06, 't2': 0.09}

    async def fake(song, song_id, *args, **kwargs):
        assert kwargs['add_to_target'] is False
        await asyncio.sleep(finish_after[song_id])
        return names[int(song_id[1:]) - 1]

    async def nothing(*args, **kwargs):
        return None

    monkeypatch.setattr(api, '_run_download', fake)
    monkeypatch.setattr(api, '_remember_pending', nothing)
    monkeypatch.setattr(api, '_finish_playlist_batch', nothing)
    asyncio.run(
        api._process_batch(
            songs,
            [song['song_id'] for song in songs],
            '',
            False,
            None,
        )
    )
    assert _files(library) == names
    # One announcement per song that landed: clients refresh as it fills.
    assert library.announced == ['playlists_changed'] * 4
