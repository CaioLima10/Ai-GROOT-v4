async function test() {
  // OEIS
  try {
    const r = await fetch('https://oeis.org/search?q=fibonacci&fmt=json&start=0&n=5')
    const d = await r.json()
    console.log('OEIS status:', r.status, 'results:', d?.results?.length, 'first:', d?.results?.[0]?.name)
  } catch (e) { console.error('OEIS error:', e.message) }

  // Canon API
  try {
    const r = await fetch('https://www.canonapi.com/v1/genesis/1.json')
    const d = await r.json()
    console.log('CanonAPI status:', r.status, 'verses:', d?.verses?.length)
  } catch (e) { console.error('CanonAPI error:', e.message) }

  // BibleSDK
  try {
    const r = await fetch('https://biblesdk.com/api/books/genesis/chapters/1/verses?concordance=true')
    const d = await r.json()
    const verses = Array.isArray(d) ? d : d?.verses || []
    console.log('BibleSDK status:', r.status, 'verses:', verses.length)
  } catch (e) { console.error('BibleSDK error:', e.message) }

  // MorphGNT - check file paths
  const paths = ['Books/61MT.txt', 'books/61MT.txt', '61MT.txt', 'text/61MT.txt']
  for (const p of paths) {
    try {
      const r = await fetch(`https://raw.githubusercontent.com/morphgnt/sblgnt/master/${p}`)
      console.log(`MorphGNT path "${p}":`, r.status)
      if (r.ok) break
    } catch (e) { console.error(`MorphGNT path "${p}" error:`, e.message) }
  }

  // Wikisource PT
  try {
    const params = new URLSearchParams({ action: 'query', titles: 'Confissão de Fé de Westminster', prop: 'extracts', exintro: '1', format: 'json', origin: '*' })
    const r = await fetch(`https://pt.wikisource.org/w/api.php?${params}`)
    const d = await r.json()
    const pages = Object.values(d?.query?.pages || {})
    console.log('WikisourcePT status:', r.status, 'pages:', pages.length, 'extract len:', pages[0]?.extract?.length)
  } catch (e) { console.error('WikisourcePT error:', e.message) }
}
test()
