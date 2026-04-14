import { Navigate, useSearchParams } from "react-router-dom";

// Redirect old /carity/auth to /market/auth
export default function CarityAuth() {
  const [searchParams] = useSearchParams();
  const mode = searchParams.get("mode") || "login";
  const redirect = searchParams.get("redirect") || "/market/my-listings";
  
  return <Navigate to={`/market/auth?mode=${mode}&redirect=${encodeURIComponent(redirect)}`} replace />;
}
