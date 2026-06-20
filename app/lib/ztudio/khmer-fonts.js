const BASE = '/fonts/khmer/'

const FONTS = [
  { family: 'AKbalthom Freedom', label: 'AKbalthom Freedom', file: 'akbalthom-freedom.ttf' },
  { family: 'AKbalthom KhmerLight', label: 'AKbalthom Khmer Light', file: 'akbalthom-khmerlight.ttf' },
  { family: 'AKbalthom KhmerNew', label: 'AKbalthom Khmer New', file: 'akbalthom-khmernew.ttf' },
  { family: 'Carlsberg Sans Light', label: 'Carlsberg Sans Light', file: 'carlsbergsans-light.ttf' },
  { family: 'Carlsberg Sans Bold', label: 'Carlsberg Sans Bold', file: 'carlsbergsans-bold.ttf' },
  { family: 'Carlsberg Sans Black', label: 'Carlsberg Sans Black', file: 'carlsbergsans-black.ttf' },
  { family: 'Dangrek', label: 'Dangrek', file: 'dangrek.ttf' },
  { family: 'Kantumruy Light', label: 'Kantumruy Light', file: 'kantumruy-light.ttf' },
  { family: 'Kantumruy', label: 'Kantumruy Regular', file: 'kantumruy-regular.ttf' },
  { family: 'Kantumruy Bold', label: 'Kantumruy Bold', file: 'kantumruy-bold.ttf' },
  { family: 'Khmer MEF1', label: 'Khmer MEF1', file: 'khmermef1.ttf' },
  { family: 'Khmer MEF2', label: 'Khmer MEF2', file: 'khmermef2.ttf' },
  { family: 'Khmer Moul', label: 'Khmer Moul', file: 'khmermoul.ttf' },
  { family: 'Khmer Muol', label: 'Khmer Muol', file: 'khmermuol.ttf' },
  { family: 'Niradei', label: 'Niradei Regular', file: 'niradei-regular.ttf' },
  { family: 'Niradei Semibold', label: 'Niradei Semibold', file: 'niradei-semibold.ttf' },
  { family: 'Niradei Bold', label: 'Niradei Bold', file: 'niradei-bold.ttf' },
  { family: 'Niradei Heavy', label: 'Niradei Heavy', file: 'niradei-heavy.ttf' },
  { family: 'PengHuoth', label: 'PengHuoth Regular', file: 'penghuoth-regular.ttf' },
  { family: 'PengHuoth Bold', label: 'PengHuoth Bold', file: 'penghuoth-bold.ttf' },
]

export const KHMER_FONTS = FONTS.map(f => ({ ...f, url: BASE + f.file }))
