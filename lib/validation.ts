import { z } from "zod";

export const DIETARY_TAGS = [
  "VEGETARIAN",
  "VEGAN",
  "GLUTEN_FREE",
  "HALAL",
  "JAIN",
  "SPICY",
  "CONTAINS_NUTS",
  "DAIRY_FREE",
] as const;

export const ALLERGENS = ["NUTS", "DAIRY", "GLUTEN", "EGG", "SOY", "SHELLFISH", "SESAME"] as const;

const email = z.string().trim().toLowerCase().email("Enter a valid email address.").max(191);
const password = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(72, "Password must be 72 characters or fewer.")
  .regex(/[A-Za-z]/, "Password must include a letter.")
  .regex(/\d/, "Password must include a number.");
const name = z.string().trim().min(2, "Please enter your name.").max(120);
const phone = z
  .string()
  .trim()
  .min(7, "Enter a contact number.")
  .max(20)
  .regex(/^[+\d][\d\s()-]+$/, "Enter a valid phone number.");

const latitude = z.coerce.number().min(-90).max(90);
const longitude = z.coerce.number().min(-180).max(180);

export const customerRegisterSchema = z.object({
  name,
  email,
  password,
  phone: phone.optional(),
  homeCity: z.string().trim().max(120).optional(),
  dietaryPreferences: z.array(z.enum(DIETARY_TAGS)).max(8).optional(),
  allergies: z.string().trim().max(500).optional(),
});

export const restaurantRegisterSchema = z.object({
  ownerName: name,
  email,
  password,
  phone,
  restaurantName: z.string().trim().min(2).max(160),
  description: z.string().trim().min(20, "Tell travellers a little about the kitchen.").max(2000),
  cuisine: z.string().trim().min(2).max(120),
  address: z.string().trim().min(10).max(300),
  latitude,
  longitude,
  openingTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm."),
  closingTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm."),
  pickupInstructions: z.string().trim().min(5).max(500),
  capacityPerHour: z.coerce.number().int().min(1).max(200).default(12),
  imageUrl: z.string().url().max(500).optional().or(z.literal("")),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password.").max(72),
  role: z.enum(["CUSTOMER", "RESTAURANT"]).optional(),
});

export const demoLoginSchema = z.object({
  role: z.enum(["CUSTOMER", "RESTAURANT"]),
});

export const journeyCreateSchema = z.object({
  startLabel: z.string().trim().min(2).max(220),
  startLat: latitude,
  startLng: longitude,
  endLabel: z.string().trim().min(2).max(220),
  endLat: latitude,
  endLng: longitude,
  corridorMeters: z.coerce.number().int().min(500).max(15000).default(3000),
  startTracking: z.boolean().optional(),
});

export const geocodeQuerySchema = z.object({
  q: z.string().trim().min(2).max(160),
  nearLat: latitude.optional(),
  nearLng: longitude.optional(),
});

export const menuItemSchema = z.object({
  name: z.string().trim().min(2, "Give the dish a name.").max(120),
  description: z.string().trim().max(1000).optional().or(z.literal("")),
  price: z.coerce.number().min(1, "Price must be at least ₹1.").max(100000),
  category: z.string().trim().min(2).max(80),
  prepTimeMinutes: z.coerce.number().int().min(1, "Preparation time must be at least 1 minute.").max(180),
  imageUrl: z.string().url().max(500).optional().or(z.literal("")),
  dietaryTags: z.array(z.enum(DIETARY_TAGS)).max(8).default([]),
  allergens: z.array(z.enum(ALLERGENS)).max(10).default([]),
  isAvailable: z.boolean().default(true),
});

export const menuAvailabilitySchema = z.object({
  isAvailable: z.boolean(),
});

export const menuItemUpdateSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    description: z.string().trim().max(1000).optional().or(z.literal("")),
    price: z.coerce.number().min(1).max(100000).optional(),
    category: z.string().trim().min(2).max(80).optional(),
    prepTimeMinutes: z.coerce.number().int().min(1).max(180).optional(),
    imageUrl: z.string().url().max(500).optional().or(z.literal("")),
    dietaryTags: z.array(z.enum(DIETARY_TAGS)).max(8).optional(),
    allergens: z.array(z.enum(ALLERGENS)).max(10).optional(),
    isAvailable: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "Provide at least one field to update.");

export const restaurantProfileSchema = z.object({
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().min(20).max(2000),
  cuisine: z.string().trim().min(2).max(120),
  address: z.string().trim().min(10).max(300),
  latitude,
  longitude,
  phone,
  openingTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  closingTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  pickupInstructions: z.string().trim().min(5).max(500),
  capacityPerHour: z.coerce.number().int().min(1).max(200),
  imageUrl: z.string().url().max(500).optional().or(z.literal("")),
  openDays: z.array(z.number().int().min(0).max(6)).min(1).max(7).default([0, 1, 2, 3, 4, 5, 6]),
});

export const bountyCreateSchema = z.object({
  journeyId: z.string().min(1),
  preferredRestaurantId: z.string().min(1).optional(),
  budget: z.coerce.number().min(20, "Budget must be at least ₹20.").max(100000),
  note: z.string().trim().max(500).optional(),
  items: z
    .array(
      z.object({
        menuItemId: z.string().min(1),
        quantity: z.coerce.number().int().min(1).max(10),
        dishName: z.string().trim().min(1).max(120).optional(),
      }),
    )
    .min(1, "Add at least one dish.")
    .max(20),
});

export const bountyRejectSchema = z.object({
  reason: z.string().trim().min(3, "Tell the traveller why.").max(200),
});

export const orderStatusSchema = z.object({
  status: z.enum(["ACCEPTED", "PREPARING", "READY", "COMPLETED", "CANCELLED", "REJECTED"]),
  note: z.string().trim().max(300).optional(),
});

export const locationUpdateSchema = z.object({
  latitude,
  longitude,
  accuracyMeters: z.coerce.number().min(0).max(10000).optional(),
  source: z.enum(["GPS", "SIMULATED", "MANUAL"]).default("GPS"),
  recordedAt: z.string().datetime().optional(),
  restaurantId: z.string().optional(),
});

export const aiChatSchema = z.object({
  message: z.string().trim().min(1, "Ask me anything about food on your route.").max(2000),
  conversationId: z.string().optional(),
  journeyId: z.string().optional(),
});

export const profileUpdateSchema = z.object({
  name: name.optional(),
  phone: phone.optional(),
  homeCity: z.string().trim().max(120).optional(),
  dietaryPreferences: z.array(z.enum(DIETARY_TAGS)).max(8).optional(),
  allergies: z.string().trim().max(500).optional(),
  defaultBudget: z.coerce.number().min(0).max(100000).optional(),
});

export type MenuItemInput = z.infer<typeof menuItemSchema>;
export type BountyCreateInput = z.infer<typeof bountyCreateSchema>;
export type JourneyCreateInput = z.infer<typeof journeyCreateSchema>;
