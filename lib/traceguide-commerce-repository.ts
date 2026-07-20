import {
  commerceContextFromDatabaseRows,
  type CommerceContext,
  type CommerceDatabaseRows,
  type TraceVariables,
} from "./traceguide-commerce-data";
import { supabase } from "./supabase";

export async function getCommerceContextFromDatabase(input: {
  scenarioKey?: CommerceDatabaseRows["task"]["scenario_key"];
  taskId?: string;
  caseId?: string;
  caseToken?: string;
  editedVariables?: TraceVariables;
}): Promise<CommerceContext | null> {
  try {
    let taskQuery = supabase.from("traceguide_experiment_tasks").select("*");
    taskQuery = input.taskId
      ? taskQuery.eq("id", input.taskId)
      : taskQuery.eq("scenario_key", input.scenarioKey);

    const taskResult = await taskQuery.limit(1).maybeSingle();
    if (taskResult.error || !taskResult.data) return null;

    const task = taskResult.data as CommerceDatabaseRows["task"];
    if (input.scenarioKey && task.scenario_key !== input.scenarioKey) {
      console.warn("TraceGuide task row scenario mismatch; using local fixture.", {
        taskId: task.id,
        expected: input.scenarioKey,
        actual: task.scenario_key,
      });
      return null;
    }

    const [customerResult, orderResult] = await Promise.all([
      supabase
        .from("traceguide_customers")
        .select("*")
        .eq("id", task.customer_id)
        .maybeSingle(),
      supabase
        .from("traceguide_orders")
        .select("*")
        .eq("id", task.order_id)
        .maybeSingle(),
    ]);
    if (
      customerResult.error ||
      orderResult.error ||
      !customerResult.data ||
      !orderResult.data
    ) {
      return null;
    }

    const order = orderResult.data as CommerceDatabaseRows["order"];
    const [productResult, fixtureEvidenceResult, serviceCaseResult] = await Promise.all([
      supabase
        .from("traceguide_products")
        .select("*")
        .eq("id", order.product_id)
        .maybeSingle(),
      supabase
        .from("traceguide_evidence_records")
        .select("*")
        .eq("order_id", order.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      input.caseId && input.caseToken
        ? supabase.rpc("traceguide_get_service_case", {
            p_case_id: input.caseId,
            p_case_token: input.caseToken,
          })
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (
      productResult.error ||
      fixtureEvidenceResult.error ||
      serviceCaseResult.error ||
      !productResult.data ||
      !fixtureEvidenceResult.data
    ) {
      return null;
    }

    const fixtureEvidence = fixtureEvidenceResult.data as CommerceDatabaseRows["evidence"];
    const serviceCase = serviceCaseResult.data && !Array.isArray(serviceCaseResult.data)
      ? serviceCaseResult.data as Record<string, unknown>
      : null;
    const facts = Array.isArray(serviceCase?.facts)
      ? serviceCase.facts as Array<Record<string, unknown>>
      : [];
    const evidenceFact = facts.find((fact) => fact.key === "evidence_status");
    const caseEvidenceStatus = typeof evidenceFact?.value === "string"
      ? evidenceFact.value
      : fixtureEvidence.status;
    const evidence = {
      ...fixtureEvidence,
      id: input.caseId && evidenceFact ? `case-${input.caseId}` : fixtureEvidence.id,
      status: caseEvidenceStatus,
      description: caseEvidenceStatus === "photos_provided"
        ? "Buyer supplied photo evidence for this service case."
        : "No damage photo is attached to this service case.",
    } as CommerceDatabaseRows["evidence"];

    return commerceContextFromDatabaseRows(
      {
        task,
        customer: customerResult.data as CommerceDatabaseRows["customer"],
        product: productResult.data as CommerceDatabaseRows["product"],
        order,
        evidence,
      },
      input.editedVariables
    );
  } catch (error) {
    console.warn("TraceGuide commerce DB context unavailable.", error);
    return null;
  }
}
