import dotenv from "dotenv"

dotenv.config()

async function main() {
  const { grootAdvancedRAG } = await import("../packages/ai-core/src/index.js")

  const stats = await grootAdvancedRAG.rebuildRemoteEmbeddings(
    Number(process.env.REBUILD_EMBEDDINGS_BATCH_SIZE || 25)
  )

  if (!stats?.remoteEnabled) {
    console.error("❌ Reconstrução remota não pôde ser concluída.", stats?.error || "")
    process.exit(1)
  }

  console.log("✅ Embeddings remotos reconstruídos com sucesso.")
  console.log(JSON.stringify(stats, null, 2))
}

main().catch(error => {
  console.error("❌ Falha ao reconstruir embeddings remotos:", error.message)
  process.exit(1)
})
