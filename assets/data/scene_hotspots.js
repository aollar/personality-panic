/*
 * PERSONALITY PANIC — painted-menu hotspot map.
 * Each scene's action menu is PAINTED INTO the art; these boxes clip the
 * painted buttons so they're clickable. Coordinates are percent of the full
 * 1672x941 scene image: [x, y, w, h] = top-left + size.
 * a = Action_ID from the Balance Lock sheet (X-ids = assumptions.js extras).
 * Mapped by hand from grid-annotated crops of every scene.
 */
var PP_HOTSPOTS = {
  lowCost: [
    { a: "X006", box: [84.0, 7.5, 14.5, 5.0] },   // PAY RENT tab
    { a: "A001", box: [70.5, 13.0, 13.5, 24.0] }, // Bunk Bed Deluxe
    { a: "A002", box: [84.0, 13.0, 14.5, 24.0] }, // Relaxation Zone
    { a: "A003", box: [70.5, 38.0, 13.5, 20.0] }, // Open-Concept Bathroom
    { a: "A004", box: [84.0, 38.0, 14.5, 20.0] }, // Former Yard Fitness
    { a: "A005", box: [70.5, 59.0, 13.5, 20.0] }, // Decorate Your Cell
    { a: "A006", box: [84.0, 59.0, 14.5, 20.0] }, // Hang With Pet
    { a: "A007", box: [70.5, 80.0, 13.5, 9.0] },  // Feed Pet
    { a: "A001", box: [70.5, 89.5, 28.0, 9.5] }   // featured: Bunk Bed
  ],
  luxury: [
    { a: "X007", box: [86.5, 11.5, 11.5, 4.5] },   // PAY RENT tab
    { a: "A009", box: [76.5, 16.0, 10.0, 17.0] }, // Sleep in Fancy Bed
    { a: "A010", box: [87.0, 16.0, 11.0, 17.0] }, // Luxury Bath
    { a: "A011", box: [76.5, 34.0, 10.0, 16.0] }, // Relax in Your Suite
    { a: "A012", box: [87.0, 34.0, 11.0, 16.0] }, // Condo Gym
    { a: "A013", box: [76.5, 50.5, 10.0, 15.0] }, // Order Fancy Food
    { a: "A014", box: [87.0, 50.5, 11.0, 15.0] }, // Host Friends
    { a: "A015", box: [76.5, 66.0, 10.0, 12.0] }, // Work From Home
    { a: "A016", box: [87.0, 66.0, 11.0, 12.0] }, // Pet Spa Treatment
    { a: "A009", box: [76.5, 79.0, 21.5, 17.0] }  // featured: Fancy Bed
  ],
  park: [
    { a: "A018", box: [69.5, 12.0, 14.5, 21.0] }, // Take a Walk
    { a: "A019", box: [84.0, 12.0, 14.5, 21.0] }, // Touch Grass
    { a: "A020", box: [69.5, 34.0, 14.5, 20.0] }, // Feed Judgmental Ducks
    { a: "A021", box: [84.0, 34.0, 14.5, 20.0] }, // Use Restroom of Uncertainty
    { a: "A022", box: [69.5, 55.0, 14.5, 20.0] }, // Nap on Park Bench
    { a: "A023", box: [84.0, 55.0, 14.5, 20.0] }, // Pick Up Loose Change
    { a: "A019", box: [69.5, 77.0, 29.0, 15.0] }, // featured: Touch Grass
    { a: "A024", box: [69.5, 92.5, 29.0, 6.5] }   // unhoused support strip -> cheque
  ],
  airOne: [
    { a: "A026", box: [70.3, 12.0, 9.7, 25.5] }, // 1 Week Groceries
    { a: "A027", box: [80.3, 12.0, 18.0, 25.5] }, // 1 Week Organic
    { a: "A028", box: [70.3, 38.5, 9.7, 24.5] }, // 4 Weeks Groceries
    { a: "A029", box: [80.3, 38.5, 18.0, 24.5] }, // $22 Smoothie
    { a: "A030", box: [70.3, 64.5, 28.0, 10.0] }, // Judge Window Shoppers
    { a: "A033", box: [76.0, 84.0, 22.5, 10.5], work: true } // WORK
  ],
  regretBurger: [
    { a: "A034", box: [68.0, 12.0, 11.0, 26.0] }, // Classic
    { a: "A035", box: [79.0, 12.0, 10.5, 26.0] }, // Double Deluxe
    { a: "A036", box: [89.5, 12.0, 9.0, 26.0] },  // Shame Shake
    { a: "A037", box: [68.0, 40.0, 12.5, 23.0] }, // Doomscroll Fries
    { a: "A038", box: [80.5, 40.0, 17.5, 23.0] }, // Emotional Support Nuggets
    { a: "A035", box: [68.0, 65.0, 30.5, 17.0] }, // featured: Double Deluxe
    { a: "A041", box: [71.0, 85.0, 25.0, 12.0], work: true } // WORK
  ],
  gym: [
    { a: "A042", box: [68.0, 11.0, 11.8, 20.0] }, // Cardio Session
    { a: "A043", box: [80.0, 11.0, 17.5, 20.0] }, // Chest Day
    { a: "A044", box: [68.0, 32.0, 11.8, 20.0] }, // Treninator Bootcamp
    { a: "A045", box: [80.0, 32.0, 17.5, 20.0] }, // Suspicious Test Booster
    { a: "A046", box: [68.0, 53.0, 11.8, 15.0] }, // Flex in Mirror
    { a: "A047", box: [80.0, 53.0, 17.5, 15.0] }, // Skip Leg Day
    { a: "A042", box: [68.0, 69.0, 30.0, 11.0] }, // featured: Cardio
    { a: "A049", box: [71.0, 88.0, 27.0, 11.0], work: true } // WORK
  ],
  temple: [
    { a: "A058", box: [71.0, 11.0, 10.5, 26.0] }, // Buy My Camp
    { a: "A059", box: [82.0, 11.0, 8.5, 26.0] },  // Surrender Thought
    { a: "A060", box: [90.5, 11.0, 8.0, 26.0] },  // Join Group Chant
    { a: "A061", box: [71.0, 39.0, 13.5, 21.0] }, // Report Doubt
    { a: "A062", box: [84.5, 39.0, 14.0, 21.0] }, // Achieve Inner Peace
    { a: "A063", box: [71.0, 62.0, 27.5, 20.0] }, // Guided Surrender Package
    { a: "A066", box: [80.0, 84.0, 19.0, 13.0], work: true } // WORK
  ],
  university: [
    { a: "A067", box: [70.5, 12.0, 12.0, 24.0] }, // Take Class
    { a: "A068", box: [83.0, 12.0, 15.0, 24.0] }, // Study Group
    { a: "A069", box: [70.5, 37.0, 12.0, 24.0] }, // Flirt With Classmate
    { a: "A070", box: [83.0, 37.0, 15.0, 24.0] }, // Finish Undergrad
    { a: "A071", box: [70.5, 62.0, 12.0, 23.0] }, // Finish Master's
    { a: "A072", box: [83.0, 62.0, 15.0, 23.0] }, // Finish PhD
    { a: "A075", box: [77.0, 87.5, 21.5, 11.0], work: true } // WORK
  ],
  soulExchange: [
    { a: "A076", box: [71.0, 9.0, 13.5, 18.0] },  // Get / Change Job
    { a: "A078", box: [84.5, 9.0, 14.0, 18.0] },  // Update Resume Secretly
    { a: "A079", box: [71.0, 28.0, 13.5, 16.0] }, // Attend Team Building
    { a: "A080", box: [84.5, 28.0, 14.0, 16.0] }, // Join Union Meeting
    { a: "A081", box: [71.0, 45.0, 13.5, 16.0] }, // Use Bathroom Timer
    { a: "A082", box: [84.5, 45.0, 14.0, 16.0] }, // Max Out Benefits
    { a: "A083", box: [71.0, 62.0, 27.5, 10.0] }, // Quit Before Benefits Start
    { a: "A076", box: [71.0, 73.0, 27.5, 15.0] }, // featured: Get/Change Job
    { a: "A077", box: [82.0, 89.0, 17.0, 10.0], work: true } // WORK
  ],
  debtstreet: [
    { a: "A085", box: [68.5, 16.0, 13.0, 14.0] }, // Open Savings Account
    { a: "A086", box: [82.0, 16.0, 16.0, 14.0] }, // Buy Bonds
    { a: "A087", box: [68.5, 31.0, 13.0, 15.0] }, // Buy Stocks
    { a: "A088", box: [82.0, 31.0, 16.0, 15.0] }, // Buy Crypto
    { a: "A089", box: [68.5, 47.0, 13.0, 15.0] }, // Read Tiny Print
    { a: "A090", box: [82.0, 47.0, 16.0, 15.0] }, // Take Lifestyle Loan
    { a: "A091", box: [68.5, 63.0, 29.5, 11.0] }, // Buy Penny Stocks
    { a: "A092", box: [76.0, 80.0, 22.0, 16.0], work: true } // WORK
  ],
  airport: [
    { a: "A093", box: [67.0, 11.0, 13.0, 25.0] }, // Fly to Hawaii
    { a: "A094", box: [80.0, 11.0, 18.5, 25.0] }, // Fly to Japan
    { a: "A095", box: [67.0, 37.0, 13.0, 22.0] }, // Fly to France
    { a: "A096", box: [80.0, 37.0, 18.5, 22.0] }, // Fly to Australia
    { a: "A097", box: [67.0, 60.0, 13.0, 22.0] }, // Long-Term Backpacking Trip
    { a: "A098", box: [80.0, 60.0, 18.5, 22.0] }, // Complain About Missing Baggage
    { a: "A101", box: [82.0, 85.0, 17.0, 13.0], work: true } // WORK
  ],
  petShop: [
    { a: "A102", box: [79.5, 5.5, 6.5, 4.0] },    // ADOPT tab
    { a: "A108", box: [92.5, 5.5, 6.0, 4.0] },    // BRIBES tab -> Bribe Inspector
    { a: "A103", box: [80.0, 12.0, 9.0, 25.0] },  // Buy Pet Food
    { a: "A104", box: [89.0, 12.0, 9.5, 25.0] },  // Buy Pet Toy
    { a: "A105", box: [80.0, 38.0, 9.0, 23.0] },  // Feed Animals
    { a: "A106", box: [89.0, 38.0, 9.5, 23.0] },  // Bathe Animals
    { a: "A107", box: [80.0, 62.0, 18.5, 21.0] }, // Play With Pet
    { a: "A110", box: [86.5, 89.0, 12.5, 10.0], work: true } // WORK
  ],
  mall: [
    { a: "A115", box: [70.0, 9.0, 11.0, 5.0] },   // STYLE tab -> Clothing
    { a: "A113", box: [81.0, 9.0, 9.0, 5.0] },    // GEAR tab -> Electronics/Appliances
    { a: "A114", box: [90.0, 9.0, 8.5, 5.0] },    // HOME tab -> Furniture
    { a: "A115", box: [70.0, 15.0, 28.5, 42.0] }, // item grid -> Clothing shop
    { a: "A115", box: [70.0, 63.0, 28.5, 16.0] }, // featured item -> Clothing shop
    { a: "A118", box: [71.0, 88.5, 27.0, 10.5], work: true } // WORK
  ]
  // club: handled separately (video + animated side menu iframe)
};
// BDC side-menu card ids -> engine actions
var PP_BDC_MAP = {
  dance: "A050", flirt: "A051", digits: "A052",
  shots: "A053", vip: "A054", stranger: "A055", work: "A057"
};
if (typeof window !== "undefined") { window.PP_HOTSPOTS = PP_HOTSPOTS; window.PP_BDC_MAP = PP_BDC_MAP; }
if (typeof module !== "undefined") module.exports = { PP_HOTSPOTS: PP_HOTSPOTS, PP_BDC_MAP: PP_BDC_MAP };
