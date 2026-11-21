import { docRoute } from "@/lib/admin-doc";
import { routineSchema } from "@/lib/routine";
import { saveRoutine } from "@/lib/site-store";
export const POST = docRoute(routineSchema, saveRoutine);
