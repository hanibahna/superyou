import { docRoute } from "@/lib/admin-doc";
import { videoLibrarySchema } from "@/lib/site";
import { saveVideoLibrary } from "@/lib/site-store";
export const POST = docRoute(videoLibrarySchema, saveVideoLibrary);
