import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  getProductDetailApi,
  type ProductDetailDto,
  type ProductVariantDto,
} from "../api/productApi";
import { addToCartApi } from "../api/cartApi";
import { useAuth } from "../contexts/AuthContext";
import ProductReviews from "../components/ProductReviews";
import BackButton from "../components/BackButton";

const formatVnd = (n: number) => n.toLocaleString("vi-VN") + "₫";

// Bộ SIZE chuẩn đầy đủ của ngành may mặc nam — hiển thị TẤT CẢ, không chỉ
// những size sản phẩm đang có sẵn. Size nào sản phẩm không có/hết hàng sẽ
// tự động bị disable (xem isSizeAvailable), không phải xoá khỏi danh sách.
const FULL_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL"];

// Bộ MÀU đầy đủ thường dùng trong thời trang nam — tương tự, hiển thị hết,
// màu nào sản phẩm không có sẽ bị disable chứ không ẩn đi.
const FULL_COLORS = [
  "Đen", "Trắng", "Xám", "Xanh Navy", "Xanh Dương", "Xanh Lá", "Xanh Rêu",
  "Be", "Nâu", "Kem", "Đỏ", "Cam", "Vàng", "Hồng", "Tím", "Bạc",
];

export default function ProductDetailPage() {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const [product, setProduct] = useState<ProductDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedVariant, setSelectedVariant] =
    useState<ProductVariantDto | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [mainImageIndex, setMainImageIndex] = useState(0);
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    if (!productId) return;
    setLoading(true);
    getProductDetailApi(Number(productId))
      .then((data) => {
        setProduct(data);
        setSelectedVariant(
          data.variants.find((v) => v.stockQuantity > 0) ??
            data.variants[0] ??
            null,
        );
      })
      .finally(() => setLoading(false));
  }, [productId]);

  async function handleAddToCart() {
    if (!isAuthenticated) {
      navigate("/login", {
        state: { from: { pathname: `/products/${productId}` } },
      });
      return;
    }
    if (!selectedVariant) {
      setMessage({ type: "error", text: "Vui lòng chọn phân loại sản phẩm" });
      return;
    }
    if (selectedVariant.stockQuantity < quantity) {
      setMessage({
        type: "error",
        text: `Chỉ còn ${selectedVariant.stockQuantity} sản phẩm trong kho`,
      });
      return;
    }

    setAdding(true);
    setMessage(null);
    try {
      await addToCartApi(selectedVariant.variantId, quantity);
      setMessage({ type: "success", text: "Đã thêm vào giỏ hàng" });
    } catch (err: any) {
      setMessage({
        type: "error",
        text: err.response?.data?.message ?? "Không thể thêm vào giỏ hàng",
      });
    } finally {
      setAdding(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-stone-500">
        Đang tải...
      </div>
    );
  }
  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center text-stone-500">
        Không tìm thấy sản phẩm
      </div>
    );
  }

  const onSale = product.salePrice != null;
  // Hiển thị TOÀN BỘ size/màu chuẩn (FULL_SIZES/FULL_COLORS), không chỉ những
  // gì sản phẩm đang có sẵn — size/màu nào sản phẩm không bán hoặc hết hàng
  // sẽ tự bị disable ở dưới (isSizeAvailable/isColorAvailable), không ẩn đi.
  const uniqueSizes = FULL_SIZES;
  const uniqueColors = FULL_COLORS;

  function getVariant(size: string, color: string) {
    return product!.variants.find((v) => v.size === size && v.color === color);
  }

  // Size chỉ bị disable khi TẤT CẢ màu của size đó đều hết hàng/không tồn tại
  function isSizeAvailable(size: string) {
    return product!.variants.some((v) => v.size === size && v.stockQuantity > 0);
  }

  // Màu bị disable nếu tổ hợp (size đang chọn + màu này) hết hàng/không tồn tại
  function isColorAvailable(color: string) {
    const size = selectedVariant?.size ?? uniqueSizes[0];
    const v = getVariant(size, color);
    return v != null && v.stockQuantity > 0;
  }

  function pickVariant(size: string, color: string) {
    const found = getVariant(size, color);
    if (!found || found.stockQuantity === 0) return; // hết hàng -> không cho chọn
    setSelectedVariant(found);
    // Đổi ảnh chính theo màu đã chọn (best-effort: ánh xạ theo thứ tự màu ->
    // thứ tự ảnh, vì hệ thống hiện chưa gắn ảnh riêng cho từng màu ở backend)
    const colorIndex = uniqueColors.indexOf(color);
    if (product!.imageUrls.length > 0) {
      setMainImageIndex(colorIndex % product!.imageUrls.length);
    }
  }

  return (
    <div className="min-h-screen bg-stone-50 px-4 py-10">
      <div className="max-w-5xl mx-auto mb-2">
        <BackButton />
      </div>
      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-10">
        {/* Gallery ảnh */}
        <div>
          <div className="aspect-[3/4] bg-stone-200 overflow-hidden mb-3">
            {product.imageUrls[mainImageIndex] ?? product.imageUrls[0] ? (
              <img
                src={product.imageUrls[mainImageIndex] ?? product.imageUrls[0]}
                alt={product.productName}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-stone-400">
                Chưa có ảnh
              </div>
            )}
          </div>
          {product.imageUrls.length > 1 && (
            <div className="grid grid-cols-4 gap-2">
              {product.imageUrls.map((url, i) => (
                <button
                  key={i}
                  onClick={() => setMainImageIndex(i)}
                  className={`aspect-square overflow-hidden bg-stone-200 border-2 ${
                    mainImageIndex === i ? "border-stone-900" : "border-transparent"
                  }`}
                >
                  <img src={url} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Thông tin + chọn mua */}
        <div>
          <p className="text-[11px] uppercase tracking-widest text-stone-500 mb-1">
            {product.brandName || product.categoryName}
          </p>
          <h1 className="text-2xl font-semibold text-stone-900 mb-3">
            {product.productName}
          </h1>

          {product.reviewCount > 0 && (
            <div className="flex items-center gap-2 mb-3 text-sm text-stone-600">
              <span className="text-orange-500">★</span>
              <span className="font-medium">
                {product.averageRating.toFixed(1)}
              </span>
              <span className="text-stone-400">
                ({product.reviewCount} đánh giá)
              </span>
            </div>
          )}

          <div className="flex items-baseline gap-3 mb-6">
            {onSale ? (
              <>
                <span className="text-xl font-semibold text-orange-700">
                  {formatVnd(product.salePrice!)}
                </span>
                <span className="text-sm text-stone-400 line-through">
                  {formatVnd(product.price)}
                </span>
              </>
            ) : (
              <span className="text-xl font-semibold text-stone-900">
                {formatVnd(product.price)}
              </span>
            )}
          </div>

          {uniqueSizes.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-medium text-stone-600 mb-2">
                Kích thước
              </p>
              <div className="flex gap-2 flex-wrap">
                {uniqueSizes.map((size) => {
                  const available = isSizeAvailable(size);
                  return (
                    <button
                      key={size}
                      disabled={!available}
                      onClick={() =>
                        pickVariant(
                          size,
                          selectedVariant?.color ?? uniqueColors[0],
                        )
                      }
                      className={`px-3 py-1.5 text-sm border relative ${
                        !available
                          ? "border-stone-200 text-stone-300 cursor-not-allowed line-through"
                          : selectedVariant?.size === size
                            ? "border-stone-900 bg-stone-900 text-white"
                            : "border-stone-300 hover:border-stone-500"
                      }`}
                    >
                      {size}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {uniqueColors.length > 0 && (
            <div className="mb-6">
              <p className="text-xs font-medium text-stone-600 mb-2">Màu sắc</p>
              <div className="flex gap-2 flex-wrap">
                {uniqueColors.map((color) => {
                  const available = isColorAvailable(color);
                  return (
                    <button
                      key={color}
                      disabled={!available}
                      onClick={() =>
                        pickVariant(
                          selectedVariant?.size ?? uniqueSizes[0],
                          color,
                        )
                      }
                      className={`px-3 py-1.5 text-sm border ${
                        !available
                          ? "border-stone-200 text-stone-300 cursor-not-allowed line-through"
                          : selectedVariant?.color === color
                            ? "border-stone-900 bg-stone-900 text-white"
                            : "border-stone-300 hover:border-stone-500"
                      }`}
                    >
                      {color}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {selectedVariant && (
            <p className="text-xs text-stone-500 mb-4">
              {selectedVariant.stockQuantity > 0
                ? `Còn ${selectedVariant.stockQuantity} sản phẩm`
                : "Tạm hết hàng phân loại này"}
            </p>
          )}

          <div className="flex items-center border border-stone-300 w-fit mb-6">
            <button
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="w-9 h-9 hover:bg-stone-100"
            >
              −
            </button>
            <span className="w-10 text-center text-sm">{quantity}</span>
            <button
              onClick={() => setQuantity((q) => q + 1)}
              className="w-9 h-9 hover:bg-stone-100"
            >
              +
            </button>
          </div>

          {message && (
            <div
              className={`mb-4 text-sm px-3 py-2 border ${
                message.type === "success"
                  ? "text-green-700 bg-green-50 border-green-200"
                  : "text-red-700 bg-red-50 border-red-200"
              }`}
            >
              {message.text}
            </div>
          )}

          <button
            onClick={handleAddToCart}
            disabled={
              adding || !selectedVariant || selectedVariant.stockQuantity === 0
            }
            className="w-full bg-orange-700 hover:bg-orange-600 disabled:opacity-50 transition-colors text-stone-50 text-sm font-semibold px-6 py-3 mb-8"
          >
            {adding ? "Đang thêm..." : "Thêm vào giỏ hàng"}
          </button>

          {product.description && (
            <div className="border-t border-stone-200 pt-4">
              <p className="text-sm font-medium text-stone-700 mb-2">
                Mô tả sản phẩm
              </p>
              <p className="text-sm text-stone-600 whitespace-pre-line">
                {product.description}
              </p>
            </div>
          )}
          {product.material && (
            <p className="text-sm text-stone-500 mt-2">
              Chất liệu: {product.material}
            </p>
          )}
        </div>
      </div>
      <ProductReviews productId={product.productId} />
    </div>
  );
}