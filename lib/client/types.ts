/** Client-safe API payload types. Dates arrive as ISO strings, Decimal as strings. */

export type Money = number | string;

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: "CUSTOMER" | "RESTAURANT";
  avatarUrl: string | null;
  isDemo: boolean;
  createdAt: string;
};

export type SessionRestaurant = {
  id: string;
  name: string;
  role: "OWNER" | "STAFF";
  verificationStatus: string;
};

export type MenuPreviewItem = {
  id: string;
  name: string;
  price: number;
  prepTimeMinutes: number;
  dietaryTags: string[];
  imageUrl: string | null;
};

export type DiscoveredRestaurant = {
  id: string;
  name: string;
  slug: string;
  cuisine: string;
  description: string;
  imageUrl: string | null;
  address: string;
  rating: number;
  ratingCount: number;
  latitude: number;
  longitude: number;
  distanceFromRouteMeters: number;
  detourMeters: number;
  routeProgress: number;
  etaMinutes: number;
  prepTimeMinutes: number;
  openNow: boolean;
  openingTime: string;
  closingTime: string;
  activeOrders: number;
  capacityPerHour: number;
  priceRange: { min: number; max: number };
  dietaryTags: string[];
  menuPreview: MenuPreviewItem[];
  suitability: "great" | "tight" | "preorder";
  suitabilityLabel: string;
};

export type Journey = {
  id: string;
  customerId: string;
  startLabel: string;
  startLatitude: string;
  startLongitude: string;
  endLabel: string;
  endLatitude: string;
  endLongitude: string;
  routeGeometry: [number, number][];
  routeDistanceMeters: number;
  routeDurationSeconds: number;
  corridorMeters: number;
  provider: string;
  isFallback: boolean;
  status: "PLANNED" | "ACTIVE" | "COMPLETED" | "CANCELLED";
  lastEtaSeconds: number | null;
  lastEtaAt: string | null;
  lastLocationAt: string | null;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type JourneyListItem = Journey & {
  bounties: Array<{ id: string; status: string; acceptedRestaurantId: string | null }>;
  orders: Array<{ id: string; status: string; orderNumber: string }>;
};

export type JourneyDetailResponse = {
  journey: Journey & {
    bounties: BountyDetail[];
    orders: OrderSummary[];
  };
  restaurants: DiscoveredRestaurant[];
};

export type RestaurantMenuPayload = {
  restaurant: {
    id: string;
    name: string;
    slug: string;
    description: string;
    cuisine: string;
    imageUrl: string | null;
    address: string;
    latitude: number;
    longitude: number;
    phone: string;
    pickupInstructions: string;
    openingTime: string;
    closingTime: string;
    rating: number;
    ratingCount: number;
    openNow: boolean;
    activeOrders: number;
    capacityPerHour: number;
    verificationStatus: string;
  };
  menu: Array<{
    id: string;
    name: string;
    description: string | null;
    price: number;
    category: string;
    prepTimeMinutes: number;
    imageUrl: string | null;
    dietaryTags: string[];
    allergens: string[];
    isAvailable: boolean;
  }>;
  corridorMatch: {
    distanceFromRouteMeters: number;
    detourMeters: number;
    routeProgress: number;
    etaMinutes: number;
  } | null;
  journey: {
    id: string;
    corridorMeters: number;
    routeDurationSeconds: number;
    startLabel: string;
    endLabel: string;
  } | null;
};

export type BountyItem = {
  id: string;
  menuItemId: string | null;
  dishName: string;
  quantity: number;
  referenceUnitPrice: Money;
};

export type BountyOfferSummary = {
  restaurantId: string;
  status: string;
  isPreferred: boolean;
};

export type BountySummary = {
  id: string;
  customerId: string;
  journeyId: string;
  preferredRestaurantId: string | null;
  acceptedRestaurantId: string | null;
  status: "OPEN" | "ACCEPTED" | "REJECTED" | "EXPIRED" | "CANCELLED";
  budget: Money;
  currency: string;
  note: string | null;
  pickupEtaMinutes: number;
  estimatedArrivalAt: string | null;
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
  items: BountyItem[];
  acceptedRestaurant: {
    id: string;
    name: string;
    cuisine: string;
    imageUrl: string | null;
    address?: string;
    phone?: string;
    pickupInstructions?: string;
  } | null;
  preferredRestaurant: { id: string; name: string } | null;
  order: {
    id: string;
    orderNumber: string;
    status: string;
    total: Money;
    estimatedReadyAt: string | null;
  } | null;
  offers: BountyOfferSummary[];
};

export type BountyDetail = BountySummary & {
  customer: { id: string; name: string };
  journey: Journey;
  offers: BountyOfferSummary[];
};

export type RestaurantBountyOffer = {
  id: string;
  bountyId: string;
  restaurantId: string;
  status: string;
  isPreferred: boolean;
  distanceFromRouteMeters: number;
  detourMeters: number;
  matchedTotal: Money | null;
  createdAt: string;
  bounty: BountyDetail & {
    customer: { name: string };
  };
};

export type OrderItem = {
  id: string;
  menuItemId: string | null;
  nameSnapshot: string;
  unitPrice: Money;
  quantity: number;
  prepTimeMinutes: number;
  lineTotal: Money;
  dietaryTags: string[];
};

export type OrderSummary = {
  id: string;
  orderNumber: string;
  status: string;
  subtotal: Money;
  fees: Money;
  total: Money;
  currency: string;
  prepTimeMinutes: number;
  pickupInstructions: string;
  customerNote: string | null;
  estimatedReadyAt: string | null;
  etaUpdatedAt: string | null;
  cookingStartAt: string | null;
  cookNotifiedAt: string | null;
  kitchenWarning: string | null;
  createdAt: string;
  items: OrderItem[];
  restaurant?: {
    id: string;
    name: string;
    cuisine: string;
    imageUrl: string | null;
    address: string;
  };
  customer?: { id: string; name: string; phone: string | null };
};

export type OrderDetail = OrderSummary & {
  customerId: string;
  restaurantId: string;
  acceptedAt: string;
  preparingAt: string | null;
  readyAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  restaurant: {
    id: string;
    name: string;
    slug: string;
    imageUrl: string | null;
    cuisine: string;
    address: string;
    latitude: string;
    longitude: string;
    phone: string;
    pickupInstructions: string;
    openingTime: string;
    closingTime: string;
  };
  customer: { id: string; name: string; phone: string | null; email: string };
  statusHistory: Array<{
    id: string;
    fromStatus: string | null;
    toStatus: string;
    actorRole: string;
    note: string | null;
    createdAt: string;
  }>;
  journey: Journey | null;
  bounty: {
    id: string;
    note: string | null;
    budget: Money;
    pickupEtaMinutes: number;
    estimatedArrivalAt: string | null;
  };
};

export type LocationPoint = {
  latitude: string;
  longitude: string;
  accuracyMeters: number | null;
  recordedAt: string;
  etaSeconds: number | null;
  source: "GPS" | "SIMULATED" | "MANUAL";
};

export type OrderDetailResponse = {
  order: OrderDetail;
  side: "customer" | "restaurant";
  latestLocation: LocationPoint | null;
  distanceToKitchenMeters: number | null;
  serverNow: string;
};

export type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string;
  orderId: string | null;
  bountyId: string | null;
  readAt: string | null;
  createdAt: string;
};

export type NotificationsResponse = {
  items: NotificationItem[];
  unread: number;
};

export type RestaurantDashboard = {
  restaurant: {
    id: string;
    name: string;
    imageUrl: string | null;
    cuisine: string;
    address: string;
    verificationStatus: string;
    isActive: boolean;
    capacityPerHour: number;
  };
  counts: Record<string, number>;
  today: { orderCount: number; completedCount: number; revenue: number };
  pendingOffers: number;
  queue: Array<{
    id: string;
    orderNumber: string;
    status: string;
    customerName: string;
    itemCount: number;
    itemPreview: string;
    total: number;
    prepTimeMinutes: number;
    estimatedReadyAt: string | null;
    etaUpdatedAt: string | null;
    cookingStartAt: string | null;
    cookNotifiedAt: string | null;
    kitchenWarning: string | null;
    createdAt: string;
  }>;
  workload: {
    activeOrders: number;
    capacityPerHour: number;
    utilisation: number;
    prepMinutesQueued: number;
  };
  scheduler: { lastTickAt: string | null; started: number; expiredBounties: number; running: boolean };
  serverNow: string;
};

export type RestaurantProfile = {
  id: string;
  name: string;
  slug: string;
  description: string;
  cuisine: string;
  imageUrl: string | null;
  address: string;
  latitude: number;
  longitude: number;
  phone: string;
  email: string;
  pickupInstructions: string;
  openingTime: string;
  closingTime: string;
  openDays: number[];
  averagePrepMinutes: number;
  capacityPerHour: number;
  verificationStatus: string;
  rating: number;
  ratingCount: number;
  isActive: boolean;
};

export type RestaurantMenuItem = {
  id: string;
  restaurantId: string;
  name: string;
  description: string | null;
  price: number;
  category: string;
  prepTimeMinutes: number;
  imageUrl: string | null;
  dietaryTags: string[];
  allergens: string[];
  isAvailable: boolean;
  isArchived: boolean;
};

export type AiChatResponse = {
  conversationId: string;
  reply: string;
  mode: "llm" | "rules";
  fallbackReason?: string;
  suggestions: string[];
  recommended: Array<{ restaurantId: string; restaurantName: string; items: string[] }>;
  contextSummary: {
    journey: string | null;
    restaurantsInCorridor: number;
    openRestaurants: number;
    budget: number;
  };
};

export type GeocodeResponse = {
  results: Array<{
    id: string;
    label: string;
    shortLabel: string;
    lat: number;
    lng: number;
    source: "nominatim" | "demo";
    type?: string;
  }>;
  fallback: boolean;
  warning?: string;
};
