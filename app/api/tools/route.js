/**
 * API Route: POST /api/tools
 * 
 * Executes tool/function calls requested by the Gemini Live API.
 * The client receives a toolCall from Gemini, sends it here for execution,
 * and sends the result back to Gemini.
 */

import { NextResponse } from "next/server";
import {
  getOrderDetails,
  checkCancellationEligibility,
  checkReturnEligibility,
} from "@/lib/order-database";

// Map of available tool functions
const toolFunctions = {
  get_order_details: (args) => getOrderDetails(args.order_id),
  check_cancellation_eligibility: (args) => checkCancellationEligibility(args.order_id),
  check_return_eligibility: (args) => checkReturnEligibility(args.order_id),
};

export async function POST(request) {
  try {
    const body = await request.json();
    const { functionName, args } = body;

    if (!functionName) {
      return NextResponse.json(
        { error: "Missing functionName in request body." },
        { status: 400 }
      );
    }

    const toolFn = toolFunctions[functionName];

    if (!toolFn) {
      return NextResponse.json(
        { error: `Unknown function: ${functionName}` },
        { status: 400 }
      );
    }

    // Execute the tool function
    const result = toolFn(args || {});

    return NextResponse.json({ result });
  } catch (error) {
    console.error("Error executing tool:", error);
    return NextResponse.json(
      { error: "Internal server error while executing tool." },
      { status: 500 }
    );
  }
}
