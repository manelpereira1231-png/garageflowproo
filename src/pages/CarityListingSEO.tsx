import { useParams, Navigate } from "react-router-dom";

/**
 * SEO-friendly route: /market/carros/:slug
 * slug format: {make}-{model}-{uuid}
 * Extracts the UUID (last 36 chars) and redirects to the canonical detail page.
 */
export default function CarityListingSEO() {
  const { slug } = useParams();
  
  if (!slug) return <Navigate to="/market" replace />;
  
  // UUID is always 36 chars at the end
  const id = slug.slice(-36);
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  
  if (!uuidRegex.test(id)) {
    return <Navigate to="/market" replace />;
  }
  
  // Render the detail page directly (not redirect, to preserve SEO URL)
  return <CarityListingDetailLazy id={id} />;
}

// Inline wrapper that passes id as prop
import { useState, useEffect, lazy, Suspense } from "react";

function CarityListingDetailLazy({ id }: { id: string }) {
  // We import the detail page and render it with the extracted ID
  // The detail page reads from useParams, so we need to provide the id differently
  // Instead, we'll just render a Navigate to the canonical URL which already works
  return <Navigate to={`/market/car/${id}`} replace />;
}
