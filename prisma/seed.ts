/**
 * Rapid Dine seed — realistic demo data along the Bengaluru → Mysuru corridor.
 *
 * Safe to re-run: it clears Rapid Dine tables first. It refuses to run against
 * a production database unless SEED_ALLOW_PRODUCTION=true.
 *
 * Demo kitchens use 24/7 opening hours so the hackathon demo is reliable at
 * any hour. Real restaurants can edit their hours in Restaurant profile.
 */
import { PrismaClient, type OrderStatus } from "@prisma/client";
import { hashPassword } from "../lib/auth/password";
import { config } from "../lib/config";
import { calculatePrepMinutes, planKitchenTiming } from "../lib/kitchen";
import { feesForSubtotal } from "../lib/matching";
import { createBounty } from "../lib/services/bounty";
import { money, toNumber } from "../lib/utils";

const prisma = new PrismaClient();

if (process.env.NODE_ENV === "production" && process.env.SEED_ALLOW_PRODUCTION !== "true") {
  console.error("Refusing to seed a production database. Set SEED_ALLOW_PRODUCTION=true to override.");
  process.exit(1);
}

const ROAD: [number, number][] = [
  [77.5946, 12.9716], [77.55, 12.945], [77.4845, 12.9172], [77.44, 12.87],
  [77.3866, 12.8018], [77.33, 12.76], [77.2802, 12.7209], [77.24, 12.69],
  [77.2065, 12.6514], [77.13, 12.62], [77.045, 12.5847], [76.98, 12.55],
  [76.8954, 12.5223], [76.8, 12.47], [76.6947, 12.4181], [76.67, 12.36],
  [76.6394, 12.2958],
];

const FOOD_IMAGES = {
  dosa: "https://images.unsplash.com/photo-1630383249896-424e482df921?auto=format&fit=crop&w=900&q=70",
  coffee: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=900&q=70",
  idli: "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=900&q=70",
  biryani: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=900&q=70",
  wrap: "https://images.unsplash.com/photo-1626700051175-6818013e1d4f?auto=format&fit=crop&w=900&q=70",
  curry: "https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=900&q=70",
  salad: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=900&q=70",
  naan: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=900&q=70",
  dessert: "https://images.unsplash.com/photo-1601050690117-94f5f6fa8bd7?auto=format&fit=crop&w=900&q=70",
  vada: "https://images.unsplash.com/photo-1606491956689-2ea866880c84?auto=format&fit=crop&w=900&q=70",
  bowl: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=900&q=70",
};

const RESTAURANT_IMAGES = {
  filter: "https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=1400&q=75",
  nandi: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1400&q=75",
  maddur: "https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=1400&q=75",
  cauvery: "https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=1400&q=75",
  bowls: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=1400&q=75",
  palace: "https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&w=1400&q=75",
};

type MenuSeed = {
  name: string;
  description: string;
  price: number;
  category: string;
  prep: number;
  tags: string[];
  allergens: string[];
  image: string;
};

const menus: Record<string, MenuSeed[]> = {
  filter: [
    { name: "Masala Dosa", description: "Crisp ghee dosa, spiced potato, coconut chutney and sambar.", price: 140, category: "Breakfast", prep: 10, tags: ["VEGETARIAN"], allergens: [], image: FOOD_IMAGES.dosa },
    { name: "Filter Coffee", description: "Strong decoction, frothed milk, served in a traditional tumbler.", price: 60, category: "Drinks", prep: 4, tags: ["VEGETARIAN"], allergens: ["DAIRY"], image: FOOD_IMAGES.coffee },
    { name: "Idli Vada", description: "Two steamed idlis and one crisp medu vada with chutney.", price: 90, category: "Breakfast", prep: 8, tags: ["VEGETARIAN"], allergens: [], image: FOOD_IMAGES.idli },
    { name: "Paneer Wrap", description: "Tandoori paneer, mint yoghurt and crunchy slaw in a warm wrap.", price: 190, category: "Wraps", prep: 12, tags: ["VEGETARIAN"], allergens: ["DAIRY", "GLUTEN"], image: FOOD_IMAGES.wrap },
    { name: "Veg Biryani", description: "Short-grain rice layered with vegetables, fried onion and raita.", price: 220, category: "Mains", prep: 16, tags: ["VEGETARIAN", "SPICY"], allergens: ["DAIRY"], image: FOOD_IMAGES.biryani },
    { name: "Badam Milk", description: "Warm almond milk with saffron and cardamom.", price: 80, category: "Drinks", prep: 4, tags: ["VEGETARIAN"], allergens: ["NUTS", "DAIRY"], image: FOOD_IMAGES.coffee },
    { name: "Rava Kesari", description: "Soft semolina pudding with ghee, cashew and raisins.", price: 100, category: "Dessert", prep: 6, tags: ["VEGETARIAN"], allergens: ["NUTS", "DAIRY"], image: FOOD_IMAGES.dessert },
  ],
  nandi: [
    { name: "Paneer Wrap", description: "Charred paneer tikka, pickled onion and mint chutney.", price: 210, category: "Wraps", prep: 14, tags: ["VEGETARIAN"], allergens: ["DAIRY", "GLUTEN"], image: FOOD_IMAGES.wrap },
    { name: "Veg Biryani", description: "Dum-cooked seasonal vegetables, saffron rice and mirchi ka salan.", price: 240, category: "Mains", prep: 18, tags: ["VEGETARIAN", "SPICY"], allergens: ["DAIRY"], image: FOOD_IMAGES.biryani },
    { name: "Dal Makhani Bowl", description: "Slow-cooked black dal with a swirl of cream, served with jeera rice.", price: 190, category: "Mains", prep: 15, tags: ["VEGETARIAN"], allergens: ["DAIRY"], image: FOOD_IMAGES.curry },
    { name: "Butter Naan", description: "Pillowy tandoor naan brushed with butter.", price: 45, category: "Breads", prep: 6, tags: ["VEGETARIAN"], allergens: ["GLUTEN", "DAIRY"], image: FOOD_IMAGES.naan },
    { name: "Lassi", description: "Thick curd lassi, lightly sweetened.", price: 80, category: "Drinks", prep: 4, tags: ["VEGETARIAN"], allergens: ["DAIRY"], image: FOOD_IMAGES.coffee },
    { name: "Chicken Curry", description: "Home-style chicken curry with tomato, ginger and garam masala.", price: 280, category: "Mains", prep: 20, tags: ["SPICY", "HALAL"], allergens: [], image: FOOD_IMAGES.curry },
    { name: "Gulab Jamun", description: "Two warm milk dumplings in cardamom syrup.", price: 70, category: "Dessert", prep: 5, tags: ["VEGETARIAN"], allergens: ["DAIRY", "GLUTEN"], image: FOOD_IMAGES.dessert },
  ],
  maddur: [
    { name: "Masala Dosa", description: "Crisp dosa with potato masala, served with two chutneys.", price: 120, category: "Breakfast", prep: 9, tags: ["VEGETARIAN"], allergens: [], image: FOOD_IMAGES.dosa },
    { name: "Maddur Vada", description: "The town's signature crisp vada with onion and curry leaf.", price: 70, category: "Snacks", prep: 7, tags: ["VEGETARIAN"], allergens: ["GLUTEN"], image: FOOD_IMAGES.vada },
    { name: "Filter Coffee", description: "Strong local filter coffee in a steel tumbler.", price: 50, category: "Drinks", prep: 4, tags: ["VEGETARIAN"], allergens: ["DAIRY"], image: FOOD_IMAGES.coffee },
    { name: "Idli Vada", description: "Idli and vada combo with sambar and chutney.", price: 80, category: "Breakfast", prep: 8, tags: ["VEGETARIAN"], allergens: [], image: FOOD_IMAGES.idli },
    { name: "Ragi Mudde Meal", description: "Ragi ball with saaru, palya and curd.", price: 180, category: "Mains", prep: 12, tags: ["VEGETARIAN", "GLUTEN_FREE"], allergens: ["DAIRY"], image: FOOD_IMAGES.curry },
    { name: "Veg Biryani", description: "Mysuru-style vegetable biryani with coconut chutney.", price: 200, category: "Mains", prep: 15, tags: ["VEGETARIAN", "SPICY"], allergens: [], image: FOOD_IMAGES.biryani },
  ],
  cauvery: [
    { name: "Veg Biryani", description: "Fragrant vegetable biryani with raita and salan.", price: 230, category: "Biryani", prep: 17, tags: ["VEGETARIAN", "SPICY"], allergens: ["DAIRY"], image: FOOD_IMAGES.biryani },
    { name: "Chicken Biryani", description: "Cauvery-style chicken biryani with fried onion and raita.", price: 290, category: "Biryani", prep: 20, tags: ["SPICY", "HALAL"], allergens: ["DAIRY"], image: FOOD_IMAGES.biryani },
    { name: "Paneer Wrap", description: "Spiced paneer wrap with onion and coriander chutney.", price: 200, category: "Wraps", prep: 12, tags: ["VEGETARIAN"], allergens: ["DAIRY", "GLUTEN"], image: FOOD_IMAGES.wrap },
    { name: "Filter Coffee", description: "Hot filter coffee to finish the meal.", price: 55, category: "Drinks", prep: 4, tags: ["VEGETARIAN"], allergens: ["DAIRY"], image: FOOD_IMAGES.coffee },
    { name: "Raita", description: "Cooling curd with cucumber and roasted cumin.", price: 40, category: "Sides", prep: 3, tags: ["VEGETARIAN", "GLUTEN_FREE"], allergens: ["DAIRY"], image: FOOD_IMAGES.salad },
    { name: "Gulab Jamun", description: "Warm milk dumplings in rose-cardamom syrup.", price: 70, category: "Dessert", prep: 5, tags: ["VEGETARIAN"], allergens: ["DAIRY", "GLUTEN"], image: FOOD_IMAGES.dessert },
  ],
  bowls: [
    { name: "Millet Bowl", description: "Foxtail millet, roasted vegetables, peanut-free dressing and seeds.", price: 240, category: "Bowls", prep: 10, tags: ["VEGAN", "GLUTEN_FREE", "DAIRY_FREE"], allergens: ["SESAME"], image: FOOD_IMAGES.bowl },
    { name: "Paneer Wrap", description: "Grilled paneer, greens and yoghurt dressing in a whole-wheat wrap.", price: 220, category: "Wraps", prep: 13, tags: ["VEGETARIAN"], allergens: ["DAIRY", "GLUTEN"], image: FOOD_IMAGES.wrap },
    { name: "Sprout Salad", description: "Moong sprouts, pomegranate, lemon and herbs.", price: 160, category: "Bowls", prep: 6, tags: ["VEGAN", "GLUTEN_FREE", "DAIRY_FREE"], allergens: [], image: FOOD_IMAGES.salad },
    { name: "Vegan Buddha Bowl", description: "Quinoa, chickpea, avocado, greens and tahini dressing.", price: 260, category: "Bowls", prep: 12, tags: ["VEGAN", "GLUTEN_FREE", "DAIRY_FREE"], allergens: ["SESAME"], image: FOOD_IMAGES.bowl },
    { name: "Cold Brew", description: "Slow-steeped single-origin coffee over ice.", price: 120, category: "Drinks", prep: 3, tags: ["VEGAN", "DAIRY_FREE"], allergens: [], image: FOOD_IMAGES.coffee },
  ],
  palace: [
    { name: "Filter Coffee", description: "Mysuru-style filter coffee with jaggery on request.", price: 70, category: "Drinks", prep: 4, tags: ["VEGETARIAN"], allergens: ["DAIRY"], image: FOOD_IMAGES.coffee },
    { name: "Masala Dosa", description: "Palace cafe dosa with potato masala and three chutneys.", price: 150, category: "Breakfast", prep: 11, tags: ["VEGETARIAN"], allergens: [], image: FOOD_IMAGES.dosa },
    { name: "Paneer Wrap", description: "Paneer bhurji wrap with mint mayo and crunchy vegetables.", price: 210, category: "Wraps", prep: 13, tags: ["VEGETARIAN"], allergens: ["DAIRY", "GLUTEN"], image: FOOD_IMAGES.wrap },
    { name: "Badam Milk", description: "Saffron almond milk, served warm.", price: 90, category: "Drinks", prep: 4, tags: ["VEGETARIAN"], allergens: ["NUTS", "DAIRY"], image: FOOD_IMAGES.coffee },
    { name: "Rava Kesari", description: "Semolina pudding with cashews and ghee.", price: 110, category: "Dessert", prep: 6, tags: ["VEGETARIAN"], allergens: ["NUTS", "DAIRY"], image: FOOD_IMAGES.dessert },
    { name: "Vegan Buddha Bowl", description: "Quinoa, roast pumpkin, chickpeas and sesame dressing.", price: 250, category: "Bowls", prep: 12, tags: ["VEGAN", "GLUTEN_FREE", "DAIRY_FREE"], allergens: ["SESAME"], image: FOOD_IMAGES.bowl },
  ],
};

const restaurantsSeed = [
  {
    key: "filter",
    name: "The Filter Coffee Stop",
    slug: "the-filter-coffee-stop",
    cuisine: "South Indian · Cafe",
    description:
      "A highway-side coffee stop in Bidadi run by the Iyer family. Crisp dosas, strong filter coffee and a shaded pickup counter for travellers on the Mysuru road.",
    address: "NH275, Bidadi, Ramanagara district, Karnataka 562109",
    latitude: 12.8018,
    longitude: 77.3866,
    phone: "+91 98450 11021",
    email: "hello@filtercoffeestop.demo",
    pickupInstructions:
      "Take the service road exit after Bidadi bus stand. Pickup window is on the left, next to the coffee roaster. Give your order number at the counter — no need to park.",
    openingTime: "00:00",
    closingTime: "23:59",
    imageUrl: RESTAURANT_IMAGES.filter,
    owner: { name: "Meera Iyer", email: "owner@rapiddine.demo" },
    rating: 4.8,
    ratingCount: 412,
    capacity: 18,
    avgPrep: 9,
  },
  {
    key: "nandi",
    name: "Nandi Kitchen",
    slug: "nandi-kitchen",
    cuisine: "North Indian",
    description:
      "A dependable North Indian kitchen at the foot of the Nandi hills road turnoff. Tandoor breads, slow-cooked dal and biryani packed for the highway.",
    address: "Bengaluru–Mysuru Highway, Ramanagara, Karnataka 562159",
    latitude: 12.7209,
    longitude: 77.2802,
    phone: "+91 98450 11022",
    email: "hello@nandikitchen.demo",
    pickupInstructions:
      "Located at the Ramanagara highway service lane, before the Nandi Hills junction. Ask for the travel pickup desk at the left counter.",
    openingTime: "00:00",
    closingTime: "23:59",
    imageUrl: RESTAURANT_IMAGES.nandi,
    owner: { name: "Rohan Rao", email: "owner.nandi@rapiddine.demo" },
    rating: 4.6,
    ratingCount: 287,
    capacity: 14,
    avgPrep: 13,
  },
  {
    key: "maddur",
    name: "Maddur Tiffins",
    slug: "maddur-tiffins",
    cuisine: "South Indian · Street Food",
    description:
      "The original Maddur vada pit stop, serving tiffins and filter coffee to highway travellers for three generations. Quick, warm and packed to carry.",
    address: "Main Road, Maddur, Mandya district, Karnataka 571428",
    latitude: 12.5847,
    longitude: 77.045,
    phone: "+91 98450 11023",
    email: "hello@maddurtiffins.demo",
    pickupInstructions:
      "On the main road opposite the Maddur bus stand. Use the 2-minute pickup bay; tell the counter staff you are a Rapid Dine traveller.",
    openingTime: "00:00",
    closingTime: "23:59",
    imageUrl: RESTAURANT_IMAGES.maddur,
    owner: { name: "Lakshmi Gowda", email: "owner.maddur@rapiddine.demo" },
    rating: 4.7,
    ratingCount: 631,
    capacity: 22,
    avgPrep: 8,
  },
  {
    key: "cauvery",
    name: "Cauvery Spice Kitchen",
    slug: "cauvery-spice-kitchen",
    cuisine: "Biryani · Mughlai",
    description:
      "Slow-cooked biryani and kebabs just off the Mandya highway. A popular dinner stop with a dedicated pre-order pickup counter.",
    address: "Mandya–Mysuru Road, Mandya, Karnataka 571401",
    latitude: 12.5223,
    longitude: 76.8954,
    phone: "+91 98450 11024",
    email: "hello@cauveryspice.demo",
    pickupInstructions:
      "Opposite the Mandya sugar factory gate. Pre-orders are handed over at the blue pickup window on the right side of the building.",
    openingTime: "00:00",
    closingTime: "23:59",
    imageUrl: RESTAURANT_IMAGES.cauvery,
    owner: { name: "Imran Khan", email: "owner.cauvery@rapiddine.demo" },
    rating: 4.5,
    ratingCount: 198,
    capacity: 16,
    avgPrep: 16,
  },
  {
    key: "bowls",
    name: "Srirangapatna Healthy Bowls",
    slug: "srirangapatna-healthy-bowls",
    cuisine: "Healthy Bowls · Cafe",
    description:
      "Plant-forward bowls, cold brew and allergen-aware packing in Srirangapatna. Built for travellers who want a lighter meal without losing time.",
    address: "River Road, Srirangapatna, Mandya district, Karnataka 571438",
    latitude: 12.4181,
    longitude: 76.6947,
    phone: "+91 98450 11025",
    email: "hello@healthybowls.demo",
    pickupInstructions:
      "Turn towards the river road after the fort gate. The pickup shelf is at the entrance; orders are labelled with your name and order number.",
    openingTime: "00:00",
    closingTime: "23:59",
    imageUrl: RESTAURANT_IMAGES.bowls,
    owner: { name: "Ananya Shetty", email: "owner.bowls@rapiddine.demo" },
    rating: 4.9,
    ratingCount: 156,
    capacity: 10,
    avgPrep: 10,
  },
  {
    key: "palace",
    name: "Mysuru Palace Cafe",
    slug: "mysuru-palace-cafe",
    cuisine: "Cafe · South Indian",
    description:
      "A calm cafe near the Mysuru palace with classic tiffins, good coffee and a quick pickup counter for arriving travellers.",
    address: "Sayyaji Rao Road, Mysuru, Karnataka 570001",
    latitude: 12.2958,
    longitude: 76.6394,
    phone: "+91 98450 11026",
    email: "hello@palacecafe.demo",
    pickupInstructions:
      "Enter from Sayyaji Rao Road, walk past the courtyard fountain. Pickup counter is beside the espresso bar.",
    openingTime: "00:00",
    closingTime: "23:59",
    imageUrl: RESTAURANT_IMAGES.palace,
    owner: { name: "Vikram Urs", email: "owner.palace@rapiddine.demo" },
    rating: 4.4,
    ratingCount: 344,
    capacity: 12,
    avgPrep: 11,
  },
];

type SeededOrder = {
  customerId: string;
  journeyId: string;
  restaurantId: string;
  lines: Array<{ name: string; qty: number }>;
  status: OrderStatus;
  etaMinutes: number;
  createdMinutesAgo: number;
  completedMinutesAgo?: number;
};

async function createSeededOrder(input: SeededOrder) {
  const menu = await prisma.menuItem.findMany({
    where: { restaurantId: input.restaurantId },
  });
  const matched = input.lines.map((line) => {
    const item = menu.find((m) => m.name === line.name);
    if (!item) throw new Error(`Seed menu item missing: ${line.name}`);
    return { item, qty: line.qty };
  });
  const subtotal = money(matched.reduce((sum, m) => sum + toNumber(m.item.price) * m.qty, 0));
  const fees = feesForSubtotal(subtotal);
  const total = money(subtotal + fees);
  const prep = calculatePrepMinutes(
    matched.map((m) => ({ prepTimeMinutes: m.item.prepTimeMinutes, quantity: m.qty })),
  );
  const now = new Date();
  const createdAt = new Date(now.getTime() - input.createdMinutesAgo * 60000);
  const completedAt =
    input.status === "COMPLETED" && input.completedMinutesAgo != null
      ? new Date(now.getTime() - input.completedMinutesAgo * 60000)
      : null;
  // Completed demo orders keep a historical ETA; live orders use a fresh ETA.
  const etaAt =
    input.status === "COMPLETED"
      ? new Date((completedAt ?? createdAt).getTime() - 5 * 60000)
      : new Date(now.getTime() + input.etaMinutes * 60000);
  const timing = planKitchenTiming({
    etaAt,
    prepTimeMinutes: prep,
    now,
    etaUpdatedAt: now,
  });

  const bounty = await prisma.bounty.create({
    data: {
      customerId: input.customerId,
      journeyId: input.journeyId,
      preferredRestaurantId: input.restaurantId,
      acceptedRestaurantId: input.restaurantId,
      status: "ACCEPTED",
      budget: Math.max(total, 500),
      pickupEtaMinutes: input.etaMinutes,
      estimatedArrivalAt: etaAt,
      expiresAt: new Date(createdAt.getTime() + 30 * 60000),
      acceptedAt: createdAt,
      createdAt,
      items: {
        create: matched.map((m) => ({
          menuItemId: m.item.id,
          dishName: m.item.name,
          quantity: m.qty,
          referenceUnitPrice: m.item.price,
        })),
      },
      offers: {
        create: {
          restaurantId: input.restaurantId,
          status: "ACCEPTED",
          isPreferred: true,
          distanceFromRouteMeters: 220,
          detourMeters: 440,
          matchedTotal: total,
          respondedAt: createdAt,
        },
      },
    },
  });

  const order = await prisma.order.create({
    data: {
      orderNumber: `RD-SEED-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
      bountyId: bounty.id,
      customerId: input.customerId,
      restaurantId: input.restaurantId,
      journeyId: input.journeyId,
      status: input.status,
      subtotal,
      fees,
      total,
      prepTimeMinutes: prep,
      pickupInstructions: "Collect at the travel pickup counter and quote your order number.",
      estimatedReadyAt: etaAt,
      etaUpdatedAt: now,
      cookingStartAt:
        input.status === "ACCEPTED" ? timing.cookingStartAt : new Date(now.getTime() - 8 * 60000),
      cookNotifiedAt:
        input.status === "ACCEPTED" ? null : new Date(now.getTime() - 10 * 60000),
      kitchenWarning: ["ACCEPTED", "PREPARING", "READY"].includes(input.status) ? timing.warning : null,
      acceptedAt: createdAt,
      preparingAt:
        ["PREPARING", "READY", "COMPLETED"].includes(input.status)
          ? new Date(now.getTime() - 12 * 60000)
          : null,
      readyAt:
        ["READY", "COMPLETED"].includes(input.status)
          ? new Date(now.getTime() - 6 * 60000)
          : null,
      completedAt,
      createdAt,
      items: {
        create: matched.map((m) => ({
          menuItemId: m.item.id,
          nameSnapshot: m.item.name,
          unitPrice: m.item.price,
          quantity: m.qty,
          prepTimeMinutes: m.item.prepTimeMinutes,
          lineTotal: money(toNumber(m.item.price) * m.qty),
          dietaryTags: m.item.dietaryTags as object,
        })),
      },
      statusHistory: {
        create: [
          { fromStatus: null, toStatus: "ACCEPTED", actorId: null, actorRole: "SYSTEM", note: "Seed order accepted", createdAt },
          ...(input.status === "COMPLETED"
            ? [
                { fromStatus: "ACCEPTED" as OrderStatus, toStatus: "PREPARING" as OrderStatus, actorId: null, actorRole: "SYSTEM", note: "Prep started", createdAt: new Date(createdAt.getTime() + 3 * 60000) },
                { fromStatus: "PREPARING" as OrderStatus, toStatus: "READY" as OrderStatus, actorId: null, actorRole: "SYSTEM", note: "Ready", createdAt: new Date(createdAt.getTime() + 12 * 60000) },
                { fromStatus: "READY" as OrderStatus, toStatus: "COMPLETED" as OrderStatus, actorId: null, actorRole: "SYSTEM", note: "Picked up", createdAt: completedAt ?? now },
              ]
            : []),
        ],
      },
    },
  });

  return order;
}

async function main() {
  console.log("Clearing existing Rapid Dine data...");
  await prisma.aIMessage.deleteMany();
  await prisma.aIConversation.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.locationUpdate.deleteMany();
  await prisma.orderStatusHistory.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.bountyOffer.deleteMany();
  await prisma.bountyItem.deleteMany();
  await prisma.bounty.deleteMany();
  await prisma.journey.deleteMany();
  await prisma.menuItem.deleteMany();
  await prisma.restaurantMembership.deleteMany();
  await prisma.restaurant.deleteMany();
  await prisma.customerProfile.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await hashPassword(config.seed.demoPassword);

  const customer = await prisma.user.create({
    data: {
      email: "traveller@rapiddine.demo",
      name: "Aarav Menon",
      phone: "+91 98860 22441",
      role: "CUSTOMER",
      passwordHash,
      isDemo: true,
      avatarUrl: null,
      customerProfile: {
        create: {
          dietaryPreferences: ["VEGETARIAN"],
          allergies: "peanuts",
          defaultBudget: 600,
          currency: "INR",
          homeCity: "Bengaluru",
        },
      },
    },
    include: { customerProfile: true },
  });

  const secondCustomer = await prisma.user.create({
    data: {
      email: "diya@rapiddine.demo",
      name: "Diya Sharma",
      phone: "+91 98860 33119",
      role: "CUSTOMER",
      passwordHash,
      isDemo: true,
      customerProfile: {
        create: { dietaryPreferences: ["VEGETARIAN"], allergies: "", defaultBudget: 500, currency: "INR", homeCity: "Bengaluru" },
      },
    },
  });

  const restaurants: Record<string, { id: string; name: string }> = {};
  for (const seed of restaurantsSeed) {
    const owner = await prisma.user.create({
      data: {
        email: seed.owner.email,
        name: seed.owner.name,
        phone: seed.phone,
        role: "RESTAURANT",
        passwordHash,
        isDemo: true,
      },
    });
    const restaurant = await prisma.restaurant.create({
      data: {
        name: seed.name,
        slug: seed.slug,
        description: seed.description,
        cuisine: seed.cuisine,
        imageUrl: seed.imageUrl,
        address: seed.address,
        latitude: seed.latitude,
        longitude: seed.longitude,
        phone: seed.phone,
        email: seed.email,
        pickupInstructions: seed.pickupInstructions,
        openingTime: seed.openingTime,
        closingTime: seed.closingTime,
        openDays: [0, 1, 2, 3, 4, 5, 6],
        averagePrepMinutes: seed.avgPrep,
        capacityPerHour: seed.capacity,
        verificationStatus: "VERIFIED",
        rating: seed.rating,
        ratingCount: seed.ratingCount,
        isActive: true,
        memberships: { create: { userId: owner.id, role: "OWNER" } },
        menuItems: {
          create: menus[seed.key].map((item) => ({
            name: item.name,
            description: item.description,
            price: item.price,
            category: item.category,
            prepTimeMinutes: item.prep,
            imageUrl: item.image,
            dietaryTags: item.tags,
            allergens: item.allergens,
            isAvailable: true,
          })),
        },
      },
    });
    restaurants[seed.key] = { id: restaurant.id, name: restaurant.name };
  }

  const now = new Date();
  const journeyBase = {
    customerId: customer.id,
    startLabel: "Bengaluru, Karnataka",
    startLatitude: 12.9716,
    startLongitude: 77.5946,
    endLabel: "Mysuru, Karnataka",
    endLatitude: 12.2958,
    endLongitude: 76.6394,
    routeGeometry: ROAD,
    routeDistanceMeters: 146000,
    routeDurationSeconds: 9900,
    corridorMeters: 4000,
    provider: "seed-demo",
    isFallback: true,
  };

  const activeJourney = await prisma.journey.create({
    data: { ...journeyBase, status: "PLANNED" },
  });
  const pastJourney = await prisma.journey.create({
    data: {
      ...journeyBase,
      customerId: customer.id,
      status: "COMPLETED",
      startedAt: new Date(now.getTime() - 5 * 86400000),
      endedAt: new Date(now.getTime() - 5 * 86400000 + 3 * 3600000),
      createdAt: new Date(now.getTime() - 5 * 86400000),
    },
  });
  const diyaActiveJourney = await prisma.journey.create({
    data: {
      ...journeyBase,
      customerId: secondCustomer.id,
      status: "ACTIVE",
      startedAt: new Date(now.getTime() - 40 * 60000),
      lastLocationAt: new Date(now.getTime() - 3 * 60000),
      lastEtaAt: new Date(now.getTime() - 3 * 60000),
      lastEtaSeconds: 1320,
    },
  });
  const diyaScheduledJourney = await prisma.journey.create({
    data: {
      ...journeyBase,
      customerId: secondCustomer.id,
      status: "ACTIVE",
      startedAt: new Date(now.getTime() - 15 * 60000),
      lastLocationAt: new Date(now.getTime() - 4 * 60000),
      lastEtaAt: new Date(now.getTime() - 4 * 60000),
      lastEtaSeconds: 960,
    },
  });
  const diyaTodayJourney = await prisma.journey.create({
    data: {
      ...journeyBase,
      customerId: secondCustomer.id,
      status: "COMPLETED",
      startedAt: new Date(now.getTime() - 4 * 3600000),
      endedAt: new Date(now.getTime() - 1 * 3600000),
    },
  });

  // Incoming bounty for the demo traveller (offered to eligible kitchens only).
  const filterMenu = await prisma.menuItem.findMany({ where: { restaurantId: restaurants.filter.id } });
  const dosa = filterMenu.find((m) => m.name === "Masala Dosa")!;
  const coffee = filterMenu.find((m) => m.name === "Filter Coffee")!;
  const openBounty = await createBounty(customer.id, {
    journeyId: activeJourney.id,
    preferredRestaurantId: restaurants.filter.id,
    budget: 500,
    note: "No onion in the dosa, please. We will collect at the counter.",
    items: [
      { menuItemId: dosa.id, quantity: 2 },
      { menuItemId: coffee.id, quantity: 2 },
    ],
  });

  // Restaurant-owned active orders used by the kitchen dashboard.
  const preparing = await createSeededOrder({
    customerId: secondCustomer.id,
    journeyId: diyaActiveJourney.id,
    restaurantId: restaurants.filter.id,
    lines: [{ name: "Masala Dosa", qty: 1 }, { name: "Idli Vada", qty: 1 }],
    status: "PREPARING",
    etaMinutes: 22,
    createdMinutesAgo: 18,
  });

  await createSeededOrder({
    customerId: secondCustomer.id,
    journeyId: diyaScheduledJourney.id,
    restaurantId: restaurants.filter.id,
    lines: [{ name: "Paneer Wrap", qty: 1 }, { name: "Filter Coffee", qty: 1 }],
    status: "ACCEPTED",
    etaMinutes: 17,
    createdMinutesAgo: 6,
  });

  await createSeededOrder({
    customerId: secondCustomer.id,
    journeyId: diyaTodayJourney.id,
    restaurantId: restaurants.filter.id,
    lines: [{ name: "Veg Biryani", qty: 1 }, { name: "Rava Kesari", qty: 1 }],
    status: "COMPLETED",
    etaMinutes: 20,
    createdMinutesAgo: 210,
    completedMinutesAgo: 170,
  });

  await createSeededOrder({
    customerId: customer.id,
    journeyId: pastJourney.id,
    restaurantId: restaurants.nandi.id,
    lines: [{ name: "Paneer Wrap", qty: 1 }, { name: "Lassi", qty: 1 }],
    status: "COMPLETED",
    etaMinutes: 35,
    createdMinutesAgo: 5 * 24 * 60,
    completedMinutesAgo: 5 * 24 * 60 - 30,
  });

  await prisma.notification.createMany({
    data: [
      {
        userId: customer.id,
        type: "SYSTEM",
        title: "Welcome to Rapid Dine",
        body: "Your demo route Bengaluru → Mysuru is ready. Your open bounty is live with eligible kitchens.",
        readAt: null,
      },
      {
        userId: customer.id,
        type: "BOUNTY_ACCEPTED",
        title: "Nandi Kitchen accepted a bounty",
        body: "Demo history: your Paneer Wrap order was completed on a previous journey.",
        readAt: new Date(now.getTime() - 4 * 86400000),
      },
    ],
  });
  const ownerMembership = await prisma.restaurantMembership.findFirst({
    where: { restaurantId: restaurants.filter.id },
  });
  if (ownerMembership) {
    await prisma.notification.create({
      data: {
        userId: ownerMembership.userId,
        type: "KITCHEN_START",
        title: "Kitchen queue is warm",
        body: "You have a preparing order and a new route bounty waiting. Open Bounties to review it.",
        restaurantId: restaurants.filter.id,
        orderId: preparing.id,
      },
    });
  }

  console.log("Seed complete.");
  console.log("──────────────────────────────────────────────");
  console.log(`Traveller:  traveller@rapiddine.demo / ${config.seed.demoPassword}`);
  console.log(`Restaurant: owner@rapiddine.demo     / ${config.seed.demoPassword}`);
  console.log(`Second traveller (demo history): diya@rapiddine.demo / ${config.seed.demoPassword}`);
  console.log(`Open bounty: ${openBounty.bounty.id} (${openBounty.eligibleCount} eligible kitchens)`);
  console.log(`Preparing order: ${preparing.orderNumber}`);
  console.log("──────────────────────────────────────────────");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
