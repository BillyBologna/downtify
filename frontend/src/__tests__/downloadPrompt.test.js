import { beforeEach, describe, expect, it, vi } from 'vitest'

let prompt
let targetModel

beforeEach(async () => {
  vi.resetModules()
  vi.stubGlobal('localStorage', {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  })
  targetModel = await import('../model/downloadTarget')
  prompt = await import('../model/downloadPrompt')
})

describe('asking which playlist a download goes to', () => {
  it('opens the question and resolves with the answer', async () => {
    const answer = prompt.chooseTarget()
    expect(prompt.promptOpen.value).toBe(true)
    prompt.answerPrompt('Gym')
    expect(await answer).toBe('Gym')
    expect(prompt.promptOpen.value).toBe(false)
  })

  it('treats just-the-library as an answer and backing out as null', async () => {
    const library = prompt.chooseTarget()
    prompt.answerPrompt('')
    expect(await library).toBe('')
    const cancelled = prompt.chooseTarget()
    prompt.answerPrompt(null)
    expect(await cancelled).toBeNull()
  })

  it('does not ask while a picker on screen decides', async () => {
    targetModel.useDownloadTarget().enter()
    expect(await prompt.chooseTarget()).toBeUndefined()
    expect(prompt.promptOpen.value).toBe(false)
    targetModel.useDownloadTarget().leave()
    const asked = prompt.chooseTarget()
    expect(prompt.promptOpen.value).toBe(true)
    prompt.answerPrompt('')
    await asked
  })

  it('keeps the question open while a playlist is being created', async () => {
    const answer = prompt.chooseTarget()
    prompt.pausePrompt()
    expect(prompt.promptOpen.value).toBe(false)
    prompt.answerPrompt('Brand new')
    expect(await answer).toBe('Brand new')
  })

  it('drops an unanswered question when a new one is asked', async () => {
    const first = prompt.chooseTarget()
    const second = prompt.chooseTarget()
    expect(await first).toBeNull()
    prompt.answerPrompt('Gym')
    expect(await second).toBe('Gym')
  })
})
