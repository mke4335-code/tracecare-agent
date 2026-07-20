import { supabase } from "./supabase";

export type PolicySearchResult = {
  chunkId: string;
  documentId: string;
  policyKey: string;
  policyVersion: number;
  title: string;
  heading: string;
  content: string;
  sourceUri: string | null;
  retrievalMode: "hybrid" | "semantic" | "full_text";
  rankScore: number;
};

type HybridRow = {
  chunk_id: string;
  document_id: string;
  policy_key: string;
  policy_version: number;
  title: string;
  heading: string;
  content: string;
  source_uri: string | null;
  retrieval_mode: PolicySearchResult["retrievalMode"];
  rank_score: number;
};

async function queryEmbedding(input: string): Promise<number[] | null> {
  const { data, error } = await supabase.functions.invoke("traceguide-embed", {
    body: { input },
  });
  if (error || !data || !Array.isArray(data.embedding) || data.embedding.length !== 384) {
    return null;
  }
  return data.embedding.every((value: unknown) => typeof value === "number")
    ? data.embedding as number[]
    : null;
}

export async function searchDamagedItemPolicy(
  question: string,
  matchCount = 3
): Promise<{ results: PolicySearchResult[]; mode: "hybrid" | "full_text" }> {
  // Explicit OR terms keep the no-cost full-text fallback useful when a
  // product name from the buyer's question is not present in policy prose.
  const controlledQuery = "damaged OR broken OR return OR refund OR replacement OR photo OR evidence OR delivery";
  const embedding = await queryEmbedding(controlledQuery);
  const { data, error } = await supabase.rpc("traceguide_hybrid_policy_search", {
    p_query_text: controlledQuery,
    p_query_embedding: embedding,
    p_match_count: matchCount,
    p_full_text_weight: 1,
    p_semantic_weight: embedding ? 1 : 0,
    p_rrf_k: 50,
  });
  if (error) throw new Error(`Policy retrieval failed: ${error.message}`);

  const rows = (data || []) as HybridRow[];
  return {
    mode: embedding ? "hybrid" : "full_text",
    results: rows.map((row) => ({
      chunkId: row.chunk_id,
      documentId: row.document_id,
      policyKey: row.policy_key,
      policyVersion: row.policy_version,
      title: row.title,
      heading: row.heading,
      content: row.content,
      sourceUri: row.source_uri,
      retrievalMode: row.retrieval_mode,
      rankScore: Number(row.rank_score),
    })),
  };
}
