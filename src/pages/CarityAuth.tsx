import { Navigate, useSearchParams } from "react-router-dom";

// Redirect old /carity/auth to unified /auth with market context
export default function CarityAuth() {
  const [searchParams] = useSearchParams();
  const mode = searchParams.get("mode") || "login";
  const redirect = searchParams.get("redirect") || "/market/my-listings";
  
  return <Navigate to={`/auth?mode=${mode}&from=market&redirect=${encodeURIComponent(redirect)}`} replace />;
}
