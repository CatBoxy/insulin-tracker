import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const platform = request.nextUrl.searchParams.get("platform") || "android";

  const latestVersion = process.env.APP_LATEST_VERSION || "1.0.0";
  const latestVersionCode = parseInt(process.env.APP_LATEST_VERSION_CODE || "1", 10);
  const apkUrl = process.env.APP_APK_URL || null;
  const required = process.env.APP_UPDATE_REQUIRED === "true";
  const message = process.env.APP_UPDATE_MESSAGE || null;

  return NextResponse.json({
    platform,
    latestVersion,
    latestVersionCode,
    apkUrl,
    required,
    message,
  });
}
