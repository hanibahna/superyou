import { ReviewsAdmin } from "@/components/admin/ReviewsAdmin";
import { listReviews } from "@/lib/growth-store";

export default async function ReviewsPage() {
  return <ReviewsAdmin initial={await listReviews(1000)} />;
}
