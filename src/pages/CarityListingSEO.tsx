import { useParams } from "react-router-dom";
import CarityListingDetail from "./CarityListingDetail";

/**
 * SEO-friendly wrapper: /market/carros/:slug
 * Slug format: {make}-{model}-{uuid}
 * Extracts UUID and renders the detail page.
 */
export default function CarityListingSEO() {
  const { slug } = useParams();
  
  if (!slug) return null;
  
  // UUID is always last 36 chars
  const id = slug.slice(-36);
  
  return <CarityListingDetail overrideId={id} />;
}
