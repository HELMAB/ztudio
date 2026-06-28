import { describe, expect, it } from 'vitest'
import {
  activeWordIndex,
  captionAt,
  cueAt,
  parseSRT,
  splitWords,
  wordBoundaryTimes,
  wordCount,
} from '@/lib/ztudio/srt'

describe('parseSRT', () => {
  it('parses a basic cue with comma millisecond separators', () => {
    const cues = parseSRT('1\n00:00:01,000 --> 00:00:02,500\nHello world')
    expect(cues).toEqual([{ start: 1, end: 2.5, text: 'Hello world' }])
  })

  it('accepts a dot as the millisecond separator', () => {
    const cues = parseSRT('1\n00:00:00.000 --> 00:00:01.250\nHi')
    expect(cues[0].start).toBe(0)
    expect(cues[0].end).toBe(1.25)
  })

  it('computes time from hours, minutes and seconds', () => {
    const cues = parseSRT('1\n01:02:03,000 --> 01:02:04,000\nx')
    expect(cues[0].start).toBe(3600 + 120 + 3)
  })

  it('strips a leading BOM and tolerates CRLF line endings', () => {
    const cues = parseSRT('﻿1\r\n00:00:01,000 --> 00:00:02,000\r\nLine')
    expect(cues).toHaveLength(1)
    expect(cues[0].text).toBe('Line')
  })

  it('keeps multi-line caption text joined with newlines', () => {
    const cues = parseSRT('1\n00:00:01,000 --> 00:00:02,000\nfirst\nsecond')
    expect(cues[0].text).toBe('first\nsecond')
  })

  it('parses multiple blocks separated by blank lines', () => {
    const cues = parseSRT(
      '1\n00:00:01,000 --> 00:00:02,000\nA\n\n2\n00:00:02,000 --> 00:00:03,000\nB',
    )
    expect(cues.map(c => c.text)).toEqual(['A', 'B'])
  })

  it('sorts cues by start time regardless of file order', () => {
    const cues = parseSRT(
      '1\n00:00:05,000 --> 00:00:06,000\nlate\n\n2\n00:00:01,000 --> 00:00:02,000\nearly',
    )
    expect(cues.map(c => c.text)).toEqual(['early', 'late'])
  })

  it('works without an index line before the timecode', () => {
    const cues = parseSRT('00:00:01,000 --> 00:00:02,000\nNo index')
    expect(cues).toHaveLength(1)
    expect(cues[0].text).toBe('No index')
  })

  it('drops cues with empty text or non-positive duration', () => {
    expect(parseSRT('1\n00:00:01,000 --> 00:00:02,000\n   ')).toEqual([])
    expect(parseSRT('1\n00:00:02,000 --> 00:00:01,000\ntext')).toEqual([])
  })

  it('returns an empty array for input with no timecodes', () => {
    expect(parseSRT('just some text\nwith no timing')).toEqual([])
  })
})

describe('cueAt / captionAt', () => {
  const cues = [
    { start: 0, end: 1, text: 'a' },
    { start: 1, end: 2, text: 'b' },
  ]

  it('finds the cue whose half-open range contains t', () => {
    expect(cueAt(0.5, cues).text).toBe('a')
    expect(cueAt(1, cues).text).toBe('b')
  })

  it('treats the end as exclusive', () => {
    // t === 1 belongs to the second cue, not the first.
    expect(cueAt(1, cues).text).toBe('b')
  })

  it('returns null in a gap or out of range', () => {
    expect(cueAt(5, cues)).toBeNull()
    expect(captionAt(5, cues)).toBe('')
  })

  it('captionAt returns the active cue text', () => {
    expect(captionAt(1.5, cues)).toBe('b')
  })
})

describe('splitWords / wordCount', () => {
  it('splits on any whitespace including newlines', () => {
    expect(splitWords('one two\nthree')).toEqual(['one', 'two', 'three'])
  })

  it('ignores leading/trailing/duplicate whitespace', () => {
    expect(wordCount('  a   b  ')).toBe(2)
  })

  it('counts empty text as zero words', () => {
    expect(wordCount('')).toBe(0)
    expect(splitWords('')).toEqual([])
  })
})

describe('activeWordIndex', () => {
  const cue = { start: 0, end: 4, text: 'w1 w2 w3 w4' }

  it('distributes words evenly across the cue duration', () => {
    expect(activeWordIndex(0, cue)).toBe(0)
    expect(activeWordIndex(1.5, cue)).toBe(1)
    expect(activeWordIndex(2.5, cue)).toBe(2)
  })

  it('clamps before the start and after the end to the first/last word', () => {
    expect(activeWordIndex(-5, cue)).toBe(0)
    expect(activeWordIndex(99, cue)).toBe(3)
  })

  it('returns -1 when the cue has no words', () => {
    expect(activeWordIndex(0, { start: 0, end: 1, text: '' })).toBe(-1)
  })
})

describe('wordBoundaryTimes', () => {
  it('returns one boundary per gap between words', () => {
    expect(wordBoundaryTimes({ start: 0, end: 4, text: 'a b c d' })).toEqual([1, 2, 3])
  })

  it('returns no boundaries for a single word', () => {
    expect(wordBoundaryTimes({ start: 0, end: 2, text: 'solo' })).toEqual([])
  })
})
