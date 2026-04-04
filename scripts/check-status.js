async function check() {
  const url = 'http://localhost:3000/pt-br/event/01KND7V3Y9SVF0RCPC68ZYE1R4'
  console.log('Fetching', url)
  const res = await fetch(url)
  console.log('Status R4:', res.status)

  const url2 = 'http://localhost:3000/pt-br/event/01KND7V3Y9SVF0RCPC68ZYE1RM'
  console.log('Fetching', url2)
  const res2 = await fetch(url2)
  console.log('Status RM:', res2.status)
}
check()
