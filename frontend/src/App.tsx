import { BrowserRouter, Routes, Route } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import CategoriesPage from "./pages/CategoriesPage";
import ShopPage from "./pages/ShopPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import AccountPage from "./pages/AccountPage";
import ProductDetailPage from "./pages/ProductDetailPage";
import CartPage from "./pages/CartPage";
import WishlistPage from "./pages/WishlistPage";
import CheckoutPage from "./pages/CheckoutPage";
import OrdersPage from "./pages/OrdersPage";
import OrderDetailPage from "./pages/OrderDetailPage";
import AdminLayout from "./pages/AdminLayout";
import AdminProductsPage from "./pages/AdminProductsPage";
import AdminInventoryPage from "./pages/AdminInventoryPage";
import AdminCategoriesPage from "./pages/AdminCategoriesPage";
import AdminVouchersPage from "./pages/AdminVouchersPage";
import AdminOrdersPage from "./pages/AdminOrdersPage";
import AdminUsersPage from "./pages/AdminUsersPage";
import AdminPosPage from "./pages/AdminPosPage";
import PosInvoicePrintPage from "./pages/PosInvoicePrintPage";
import AdminStatisticsPage from "./pages/AdminStatisticsPage";
import VNPayResultPage from "./pages/VNPayResultPage";
import RequireAuth from "./components/RequireAuth";
import RequireAdminRoute from "./components/RequireAdminRoute";
import FloatingSocialButtons from "./components/FloatingSocialButtons";
import ChatWidget from "./components/chat/ChatWidget";
import Layout from "./components/Layout.tsx";
import ReturnPolicyPage from "./pages/ReturnPolicyPage.tsx";
import ShippingPolicyPage from "./pages/ShippingPolicyPage.tsx";
import PrivacyPolicyPage from "./pages/PrivacyPolicyPage.tsx";
import TermsPage from "./pages/TermsPage.tsx";
import { AuthProvider } from "./contexts/AuthContext";
import { CartProvider } from "./contexts/CartContext";
import { WishlistProvider } from "./contexts/WishlistContext";

function App() {
  return (
    <AuthProvider>
      <CartProvider>
      <WishlistProvider>
      <BrowserRouter>
        <FloatingSocialButtons />
        <ChatWidget />
        <Routes>
          {/* Chỉ 2 route này KHÔNG cần đăng nhập */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Các trang chính sách công khai (không cần đăng nhập) */}
          <Route element={<Layout />}>
            <Route
              path="/chinh-sach-doi-tra"
              element={<ReturnPolicyPage />}
            />
            <Route
              path="/chinh-sach-van-chuyen"
              element={<ShippingPolicyPage />}
            />
            <Route
              path="/chinh-sach-bao-mat"
              element={<PrivacyPolicyPage />}
            />
            <Route path="/dieu-khoan-su-dung" element={<TermsPage />} />
          </Route>

          {/* MỌI route còn lại — kể cả trang chủ — bắt buộc đăng nhập */}
          <Route element={<RequireAuth />}>
            {/* Header + Footer cố định cho mọi trang khách hàng */}
            <Route element={<Layout />}>
              <Route path="/" element={<LandingPage />} />
              <Route path="/categories" element={<CategoriesPage />} />
              <Route path="/shop" element={<ShopPage />} />
              <Route path="/account" element={<AccountPage />} />
              <Route
                path="/products/:productId"
                element={<ProductDetailPage />}
              />
              <Route path="/cart" element={<CartPage />} />
              <Route path="/wishlist" element={<WishlistPage />} />
              <Route path="/checkout" element={<CheckoutPage />} />
              <Route path="/orders" element={<OrdersPage />} />
              <Route path="/orders/:orderId" element={<OrderDetailPage />} />
              <Route path="/vnpay-result" element={<VNPayResultPage />} />
            </Route>

            {/* allowStaff -- STAFF được vào khu vực /admin nói chung, quyền THẬT theo từng trang/hành
                động cụ thể do backend (ma trận role_permission) quyết định. */}
            <Route element={<RequireAdminRoute allowStaff />}>
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<AdminStatisticsPage />} />
                <Route path="statistics" element={<AdminStatisticsPage />} />
                <Route path="pos" element={<AdminPosPage />} />
                <Route path="products" element={<AdminProductsPage />} />
                <Route path="categories" element={<AdminCategoriesPage />} />
                <Route path="vouchers" element={<AdminVouchersPage />} />
                <Route path="orders" element={<AdminOrdersPage />} />

                {/* Kho tồn hàng + Người dùng: chặn kép bằng RequireAdminRoute lần 2 (mặc định CHỈ
                    ADMIN, không allowStaff) — khớp đúng SecurityConfig backend, 2 khu vực này luôn
                    khoá cứng ADMIN, không qua ma trận STAFF. */}
                <Route element={<RequireAdminRoute />}>
                  <Route path="inventory" element={<AdminInventoryPage />} />
                  <Route path="users" element={<AdminUsersPage />} />
                </Route>
              </Route>

              {/* Cố tình NẰM NGOÀI AdminLayout -- không sidebar/header quản trị, mở ở tab riêng để in. */}
              <Route path="/admin/pos/invoices/:orderId/print" element={<PosInvoicePrintPage />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
      </WishlistProvider>
      </CartProvider>
    </AuthProvider>
  );
}

export default App;