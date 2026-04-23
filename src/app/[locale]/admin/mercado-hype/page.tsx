import MercadoHypeClient from './_components/MercadoHypeClient'

export default async function MercadoHypePage() {
  return (
    <MercadoHypeClient
      initialGlobalHype={[]}
      initialBrazilHype={[]}
      initialPublished={[]}
    />
  )
}
