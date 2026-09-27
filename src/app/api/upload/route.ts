import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveStaffContext } from "@/lib/auth/staff-context";
import cloudinary from "@/lib/cloudinary";
import type { UploadApiResponse, UploadApiErrorResponse } from "cloudinary";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ message: "Staff authentication required" }, { status: 401 });
    }

    const staffContext = await resolveStaffContext(user);
    if (!staffContext) {
      return NextResponse.json({ message: "Staff access required" }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ message: "No image file provided" }, { status: 400 });
    }

    const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
    const maxBytes = 5 * 1024 * 1024;
    if (!allowedTypes.has(file.type)) {
      return NextResponse.json({ message: "Only JPG, PNG, and WebP images are allowed" }, { status: 415 });
    }
    if (file.size <= 0 || file.size > maxBytes) {
      return NextResponse.json({ message: "Image must be smaller than 5 MB" }, { status: 413 });
    }

    // Convert Web File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Stream upload directly to Cloudinary
    const result = await new Promise<UploadApiResponse>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: `order-desk/${staffContext.restaurantId || "menu"}`,
          resource_type: "image",
          transformation: [
            { width: 600, height: 600, crop: "fill", gravity: "auto", fetch_format: "auto", quality: "auto" },
          ],
        },
        (error: UploadApiErrorResponse | undefined, res: UploadApiResponse | undefined) => {
          if (error || !res) {
            reject(error || new Error("Cloudinary upload failed"));
          } else {
            resolve(res);
          }
        }
      );

      uploadStream.end(buffer);
    });

    return NextResponse.json({
      ok: true,
      url: result.secure_url,
      publicId: result.public_id,
      width: result.width,
      height: result.height,
    });
  } catch (error) {
    console.error("Cloudinary upload route error:", error);
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Image upload failed" },
      { status: 500 }
    );
  }
}
