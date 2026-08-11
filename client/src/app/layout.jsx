import { AuthProvider } from "@/context/auth-context";
import "./globals.css";

export const metadata = {
  title: "WorkNest",
  description: "Role-based project and task tracking",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
