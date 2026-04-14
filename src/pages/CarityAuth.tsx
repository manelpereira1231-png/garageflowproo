import { Navigate, useSearchParams } from "react-router-dom";

// Carity auth is now unified with the main auth system
// Redirect to /auth with Carity context
export default function CarityAuth() {
  const [searchParams] = useSearchParams();
  const mode = searchParams.get("mode") || "login";
  const redirect = searchParams.get("redirect") || "/carity/meus-anuncios";
  
  return <Navigate to={`/auth?mode=${mode}&from=carity&redirect=${encodeURIComponent(redirect)}`} replace />;
}
