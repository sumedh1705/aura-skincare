/**
 * Mock Order Database for Aura Skincare
 * Contains the 3 test orders from the assessment specification.
 */

const orders = {
  "ORD-101": {
    orderId: "ORD-101",
    customerName: "Priya Sharma",
    product: "Vitamin C Serum (30ml)",
    value: 699,
    status: "Out for Delivery",
    courier: "BlueDart",
    trackingId: "BD-982103",
    notes: "Expected by 6 PM today",
    orderDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
    deliveryDate: null,
  },
  "ORD-102": {
    orderId: "ORD-102",
    customerName: "Rahul Verma",
    product: "Hydrating Sunscreen SPF 50",
    value: 499,
    status: "Delivered",
    courier: "Delhivery",
    trackingId: "DL-441029",
    notes: "Delivered 14 days ago",
    orderDate: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000).toISOString(), // 18 days ago
    deliveryDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days ago
  },
  "ORD-103": {
    orderId: "ORD-103",
    customerName: "Ananya Patel",
    product: "Green Tea Face Wash + Toner",
    value: 850,
    status: "Processing",
    courier: null,
    trackingId: null,
    notes: "Ordered 3 hours ago. Eligible for cancellation",
    orderDate: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), // 3 hours ago
    deliveryDate: null,
  },
};

/**
 * Look up order details by order ID.
 * @param {string} orderId - The order ID to look up (e.g., "ORD-101")
 * @returns {object} Order details or error message
 */
export function getOrderDetails(orderId) {
  // Normalize the order ID (handle common variations)
  const normalizedId = orderId?.toString().trim().toUpperCase();

  if (!normalizedId) {
    return {
      success: false,
      error: "No order ID was provided. Please ask the customer for their order ID.",
    };
  }

  const order = orders[normalizedId];

  if (!order) {
    return {
      success: false,
      error: `No order found with ID "${normalizedId}". Please verify the order ID with the customer. Valid format is ORD-XXX.`,
    };
  }

  return {
    success: true,
    order: { ...order },
  };
}

/**
 * Check if an order is eligible for cancellation.
 * Policy: Orders can only be cancelled while status is "Processing".
 * @param {string} orderId
 * @returns {object} Cancellation eligibility result
 */
export function checkCancellationEligibility(orderId) {
  const result = getOrderDetails(orderId);

  if (!result.success) {
    return result;
  }

  const order = result.order;
  const canCancel = order.status === "Processing";

  return {
    success: true,
    orderId: order.orderId,
    currentStatus: order.status,
    canCancel,
    reason: canCancel
      ? "This order is still being processed and is eligible for cancellation."
      : `This order is currently "${order.status}" and cannot be cancelled. ${
          order.status === "Out for Delivery" || order.status === "Shipped"
            ? "The customer may refuse delivery at the doorstep instead."
            : ""
        }`,
  };
}

/**
 * Check if an order is eligible for return/refund.
 * Policy: Returns accepted within 7 days of delivery for unopened, unused products.
 * Damaged/defective must be reported within 48 hours with photos.
 * @param {string} orderId
 * @returns {object} Return eligibility result
 */
export function checkReturnEligibility(orderId) {
  const result = getOrderDetails(orderId);

  if (!result.success) {
    return result;
  }

  const order = result.order;

  if (order.status !== "Delivered") {
    return {
      success: true,
      orderId: order.orderId,
      canReturn: false,
      reason: `This order has not been delivered yet (current status: "${order.status}"). Returns can only be initiated for delivered orders.`,
    };
  }

  const deliveryDate = new Date(order.deliveryDate);
  const daysSinceDelivery = Math.floor(
    (Date.now() - deliveryDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  const withinReturnWindow = daysSinceDelivery <= 7;
  const withinDamageWindow = daysSinceDelivery <= 2;

  return {
    success: true,
    orderId: order.orderId,
    daysSinceDelivery,
    withinReturnWindow,
    withinDamageWindow,
    canReturn: withinReturnWindow,
    reason: withinReturnWindow
      ? "This order is within the 7-day return window. The product must be unopened and in original packaging."
      : `This order was delivered ${daysSinceDelivery} days ago, which is outside the 7-day return window. Returns cannot be processed.`,
    damageNote: withinDamageWindow
      ? "If the product is damaged or defective, the customer can report it with photos for a replacement."
      : "The 48-hour window for reporting damaged/defective products has also passed.",
  };
}

/**
 * Get all orders (for display in the test panel)
 * @returns {object[]} Array of all orders
 */
export function getAllOrders() {
  return Object.values(orders);
}
