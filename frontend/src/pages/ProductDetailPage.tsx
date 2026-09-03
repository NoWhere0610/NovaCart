import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { IconHeart, IconHeartFilled } from "@tabler/icons-react";
import {
  getProductDetailApi,
  type ProductDetailDto,
  type ProductVariantDto,
} from "../api/productApi";
import { addToCartApi } from "../api/cartApi";
import { useAuth } from "../contexts/AuthContext";
import { useCart } from "../contexts/CartContext";
import { useWishlist } from "../contexts/WishlistContext";
import { addRecentlyViewed } from "../utils/recentlyViewed";
import { colorToHex } from "../utils/colorSwatches";
import ProductReviews from "../components/ProductReviews";
import BackButton from "../components/BackButton";
import Breadcrumb from "../components/Breadcrumb";
import SearchableSelect from "../components/SearchableSelect";

const formatVnd = (n: number) => n.toLocaleString("vi-VN") + "₫";

// Bộ size chuẩn -- luôn hiển thị hết, size không có/hết hàng bị disable (xem isSizeAvailable) chứ không ẩn.
const FULL_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL"];

// Bộ màu chuẩn -- tương tự, màu không có sẽ bị disable chứ không ẩn.
const FULL_COLORS = [
  "Đen", "Trắng", "Xám", "Xanh Navy", "Xanh Dương", "Xanh Lá", "Xanh Rêu",
  "Be", "Nâu", "Kem", "Đỏ", "Cam", "Vàng", "Hồng", "Tím", "Bạc",
];

export default function ProductDetailPage() {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { applyCart } = useCart();
  const { isWishlisted, toggle: toggleWishlist } = useWishlist();
  const wishlisted = productId ? isWishlisted(Number(productId)) : false;

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
        addRecentlyViewed(Number(productId));
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
      const data = await addToCartApi(selectedVariant.variantId, quantity);
      applyCart(data);
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
  // Size hiển thị toàn bộ chuẩn, size không bán/hết hàng tự disable ở dưới.
  const uniqueSizes = FULL_SIZES;
  // Màu ngược lại -- chỉ hiện màu sản phẩm thật sự có, ẩn hẳn màu không hề bán (tránh rối mắt vì quá nhiều màu mờ không liên quan).
  const uniqueColors = FULL_COLORS.filter((c) =>
    product!.variants.some((v) => v.color === c),
  );

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
    let found = getVariant(size, color);
    // Nếu tổ hợp (size, màu đang chọn) hết hàng nhưng size này còn hàng ở màu khác, tự chuyển sang màu đầu tiên còn hàng.
    if (!found || found.stockQuantity === 0) {
      found = product!.variants.find(
        (v) => v.size === size && v.stockQuantity > 0,
      );
    }
    if (!found) return; // size này không còn hàng ở bất kỳ màu nào
    setSelectedVariant(found);
    // Đổi ảnh chính theo màu (best-effort: ánh xạ theo thứ tự, chưa có ảnh riêng theo màu ở backend)
    const colorIndex = uniqueColors.indexOf(color);
    if (product!.imageUrls.length > 0) {
      setMainImageIndex(colorIndex % product!.imageUrls.length);
    }
  }

  return (
    <div className="min-h-screen bg-stone-50 bg-herringbone px-4 py-10">
      <div className="max-w-6xl mx-auto mb-2">
        <BackButton />
        <Breadcrumb
          items={[
            { label: 'Trang chủ', to: '/' },
            { label: 'Shop', to: '/shop' },
            // categoryName không kèm slug -- hiện chữ thường, không link, tránh đoán slug sai.
            ...(product.categoryName ? [{ label: product.categoryName }] : []),
            { label: product.productName },
          ]}
        />
      </div>
      {/* Card bao ảnh/thông tin, khớp style Cart/Checkout. */}
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-10 bg-white border border-stone-200 shadow-sm p-6 md:p-8">
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
            {/* "No Brand" là giá trị thật trong DB -- coi tương đương "chưa có brand", không hiện nguyên văn. */}
            {product.brandName && product.brandName !== 'No Brand' ? product.brandName : product.categoryName}
          </p>
          <h1 className="font-display text-2xl font-semibold text-stone-900 mb-3">
            {product.productName}
          </h1>

          {product.reviewCount > 0 && (
            <div className="flex items-center gap-2 mb-3 text-sm text-stone-600">
              <span className="text-gold-dark">★</span>
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
                <span className="text-xl font-semibold text-red-600">
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
            <div className="mb-4 max-w-xs">
              <p className="text-xs font-medium text-stone-600 mb-2">
                Kích thước
              </p>
              <SearchableSelect
                placeholder="Chọn kích thước..."
                value={selectedVariant?.size ?? ""}
                options={uniqueSizes.map((size) => ({
                  value: size,
                  label: isSizeAvailable(size) ? size : `${size} (Hết hàng)`,
                  disabled: !isSizeAvailable(size),
                }))}
                onChange={(size) =>
                  pickVariant(size, selectedVariant?.color ?? uniqueColors[0])
                }
              />
            </div>
          )}

          {uniqueColors.length > 0 && (
            <div className="mb-6">
              <p className="text-xs font-medium text-stone-600 mb-2">
                Màu sắc{selectedVariant?.color ? `: ${selectedVariant.color}` : ""}
              </p>
              {/* Vẫn giữ tên màu ở nhãn phía trên, không chỉ dựa vào swatch (hỗ trợ người khó phân biệt màu). */}
              <div className="flex gap-2.5 flex-wrap" role="radiogroup" aria-label="Màu sắc">
                {uniqueColors.map((color) => {
                  const available = isColorAvailable(color);
                  const selected = selectedVariant?.color === color;
                  return (
                    <label
                      key={color}
                      title={color}
                      className={`relative w-8 h-8 rounded-full border border-stone-300 transition-all has-focus-visible:outline-2 has-focus-visible:outline-gold-dark ${
                        selected ? "ring-2 ring-offset-2 ring-stone-900" : ""
                      } ${!available ? "cursor-not-allowed opacity-40" : "cursor-pointer hover:scale-110"}`}
                      style={{ backgroundColor: colorToHex(color) }}
                    >
                      <input
                        type="radio"
                        name="product-color"
                        className="sr-only"
                        aria-label={color}
                        checked={selected}
                        disabled={!available}
                        onChange={() =>
                          pickVariant(
                            selectedVariant?.size ?? uniqueSizes[0],
                            color,
                          )
                        }
                      />
                      {!available && (
                        <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <span className="w-full h-px bg-stone-500 rotate-45" />
                        </span>
                      )}
                    </label>
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

          <div className="flex gap-3 mb-8">
            <button
              onClick={handleAddToCart}
              disabled={
                adding || !selectedVariant || selectedVariant.stockQuantity === 0
              }
              className="flex-1 bg-stone-900 border-gold-metallic gold-glow disabled:opacity-50 text-stone-50 text-sm font-semibold px-6 py-3"
            >
              {adding ? "Đang thêm..." : "Thêm vào giỏ hàng"}
            </button>
            <button
              onClick={() => toggleWishlist(Number(productId))}
              aria-label={wishlisted ? "Bỏ khỏi yêu thích" : "Thêm vào yêu thích"}
              className="w-12 flex items-center justify-center border border-stone-300 hover:border-red-300 text-red-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-dark"
            >
              {wishlisted ? <IconHeartFilled size={20} /> : <IconHeart size={20} stroke={1.8} />}
            </button>
          </div>

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