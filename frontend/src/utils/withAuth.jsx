import { Navigate } from "react-router-dom";

const withAuth = (WrappedComponent) => {
  const AuthComponent = (props) => {
    // Expired / invalid tokens are cleared by the API client (AuthContext),
    // which then sends the user back here.
    if (!localStorage.getItem("token")) {
      return <Navigate to="/auth" replace />;
    }
    return <WrappedComponent {...props} />;
  };

  return AuthComponent;
};

export default withAuth;
