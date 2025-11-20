import { NextResponse } from "next/server";
import { Env } from "@/config";

export async function GET() {
  return NextResponse.json(Env);
}
