import { PrismaClient, SpotCategory, SpotVisibility } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const TEST_PASSWORD = "password123";
const TEST_CIRCLE_INVITE_CODE = "TESTCLE1";
const EXPLORERS_CIRCLE_CODE = "EXPLOR01";

async function upsertUser(email: string, displayName: string, pictureUrl?: string) {
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
  return prisma.user.upsert({
    where: { email },
    update: { displayName, pictureUrl },
    create: { email, displayName, passwordHash, pictureUrl },
  });
}

async function main() {
  console.log("🌱 Début du seed des données locales de test (fake data)...");

  // 1. Utilisateurs de test
  const ada = await upsertUser("ada@test.dev", "Ada Lovelace", "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150");
  const bob = await upsertUser("bob@test.dev", "Bob Marley", "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150");
  const clara = await upsertUser("clara@test.dev", "Clara Oswald", "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150");
  const david = await upsertUser("david@test.dev", "David Bowie", "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150");
  const elena = await upsertUser("elena@test.dev", "Elena Fisher", "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150");

  // 2. Cercles de test
  const circleMain = await prisma.circle.upsert({
    where: { inviteCode: TEST_CIRCLE_INVITE_CODE },
    update: { name: "Cercle de test" },
    create: {
      name: "Cercle de test",
      ownerId: ada.id,
      inviteCode: TEST_CIRCLE_INVITE_CODE,
      members: {
        create: [
          { userId: ada.id },
          { userId: bob.id },
          { userId: clara.id },
          { userId: david.id },
        ],
      },
    },
  });

  // Ensure members exist in circleMain
  for (const u of [ada, bob, clara, david]) {
    await prisma.circleMember.upsert({
      where: { circleId_userId: { circleId: circleMain.id, userId: u.id } },
      update: {},
      create: { circleId: circleMain.id, userId: u.id },
    });
  }

  const circleExplorers = await prisma.circle.upsert({
    where: { inviteCode: EXPLORERS_CIRCLE_CODE },
    update: { name: "Explorateurs Urbains" },
    create: {
      name: "Explorateurs Urbains",
      ownerId: bob.id,
      inviteCode: EXPLORERS_CIRCLE_CODE,
      members: {
        create: [
          { userId: bob.id },
          { userId: clara.id },
          { userId: elena.id },
          { userId: ada.id },
        ],
      },
    },
  });

  for (const u of [bob, clara, elena, ada]) {
    await prisma.circleMember.upsert({
      where: { circleId_userId: { circleId: circleExplorers.id, userId: u.id } },
      update: {},
      create: { circleId: circleExplorers.id, userId: u.id },
    });
  }

  // 3. Lieux (Places)
  const placesData = [
    { name: "Maison Ada", lat: 48.8566, lng: 2.3522, circleId: circleMain.id, radius: 150 },
    { name: "Bureau Station F", lat: 48.8348, lng: 2.3712, circleId: circleMain.id, radius: 200 },
    { name: "Parc des Buttes-Chaumont", lat: 48.8800, lng: 2.3831, circleId: circleMain.id, radius: 250 },
    { name: "Base Explorateurs", lat: 48.8584, lng: 2.3600, circleId: circleExplorers.id, radius: 180 },
  ];

  for (const p of placesData) {
    const existing = await prisma.place.findFirst({
      where: { circleId: p.circleId, name: p.name },
    });
    if (!existing) {
      await prisma.place.create({
        data: {
          circleId: p.circleId,
          name: p.name,
          latitude: p.lat,
          longitude: p.lng,
          radiusMeters: p.radius,
        },
      });
    }
  }

  // 4. Pépites / Spots (Points d'intérêt sociaux)
  const spotsData = [
    {
      title: "Le Belvédère Caché des Buttes-Chaumont",
      description: "Superbe vue au coucher du soleil, peu de monde si on passe par le sentier en contrebas après 19h.",
      category: SpotCategory.viewpoint,
      visibility: SpotVisibility.public,
      latitude: 48.8809,
      longitude: 2.3828,
      address: "Parc des Buttes-Chaumont, 75019 Paris",
      tags: ["sunset", "vue", "chill", "romantique"],
      createdById: ada.id,
      circleId: null,
      comments: [
        { userId: bob.id, message: "Incroyable spot ! Les couleurs sur la ville hier soir étaient magiques 🌅" },
        { userId: clara.id, message: "Astuce : prévoyez un plaid, les bancs en haut sont souvent pris." },
      ],
      likedBy: [bob.id, clara.id, david.id, elena.id],
      savedBy: [ada.id, bob.id],
    },
    {
      title: "Passage des Panoramas & Galerie Secrète",
      description: "Le plus ancien passage couvert de Paris avec des verrières d'époque et une ambiance hors du temps.",
      category: SpotCategory.culture,
      visibility: SpotVisibility.public,
      latitude: 48.8712,
      longitude: 2.3421,
      address: "11 Boulevard Montmartre, 75002 Paris",
      tags: ["retro", "histoire", "architecture", "couvert"],
      createdById: clara.id,
      circleId: null,
      comments: [
        { userId: ada.id, message: "Parfait quand il pleut, les petits salons de thé sont super calmes." },
      ],
      likedBy: [ada.id, bob.id, elena.id],
      savedBy: [ada.id],
    },
    {
      title: "Café Discret & Patio Végétalisé",
      description: "Un patio secret à l'abri du bruit pour boire un chaï latte ou travailler tranquillement.",
      category: SpotCategory.cafe_bar,
      visibility: SpotVisibility.circle,
      latitude: 48.8631,
      longitude: 2.3685,
      address: "Rue Charlot, 75003 Paris",
      tags: ["cafe", "calme", "terrasse", "wifi"],
      createdById: bob.id,
      circleId: circleMain.id,
      comments: [
        { userId: david.id, message: "Le matcha latte glacé est une pépite !" },
      ],
      likedBy: [ada.id, david.id],
      savedBy: [bob.id],
    },
    {
      title: "Escalier Mosaïque Street Art",
      description: "Perspective magnifique sur les toits avec des mosaïques colorées le long des marches secrètes.",
      category: SpotCategory.photo,
      visibility: SpotVisibility.public,
      latitude: 48.8872,
      longitude: 2.3401,
      address: "Montmartre, 75018 Paris",
      tags: ["street-art", "photo", "montmartre", "instagram"],
      createdById: david.id,
      circleId: null,
      comments: [
        { userId: elena.id, message: "La lumière du matin entre 8h et 10h donne les meilleurs clichés 📸" },
      ],
      likedBy: [ada.id, bob.id, clara.id],
      savedBy: [david.id, elena.id],
    },
    {
      title: "Jardin Sauvage du Ruisseau (Petite Ceinture)",
      description: "Ancienne voie ferrée transformée en oasis de biodiversité avec potagers et ruches.",
      category: SpotCategory.nature,
      visibility: SpotVisibility.circle,
      latitude: 48.8975,
      longitude: 2.3478,
      address: "Petite Ceinture 18e, Paris",
      tags: ["nature", "fleurs", "biodiversite", "balade"],
      createdById: elena.id,
      circleId: circleMain.id,
      comments: [
        { userId: ada.id, message: "Très reposant le dimanche après-midi." },
      ],
      likedBy: [ada.id, bob.id],
      savedBy: [],
    },
    {
      title: "Speakeasy Bar Secret Lavomatic",
      description: "Passe derrière la fausse machine à laver au fond pour découvrir un bar à cocktails caché.",
      category: SpotCategory.secret_place,
      visibility: SpotVisibility.public,
      latitude: 48.8687,
      longitude: 2.3654,
      address: "30 Rue René Boulanger, 75010 Paris",
      tags: ["cocktails", "speakeasy", "night", "insolite"],
      createdById: bob.id,
      circleId: null,
      comments: [
        { userId: clara.id, message: "Tire sur le hublot de la 4ème machine pour ouvrir le passage !" },
      ],
      likedBy: [ada.id, clara.id, david.id, elena.id],
      savedBy: [clara.id, bob.id],
    },
    {
      title: "Comptoir Street Food & Baos Fondants",
      description: "Petite échoppe discrète servant les meilleurs baos vapeur artisanaux de Paris.",
      category: SpotCategory.food,
      visibility: SpotVisibility.public,
      latitude: 48.8645,
      longitude: 2.3550,
      address: "Rue Réaumur, 75003 Paris",
      tags: ["streetfood", "bao", "asian", "gourmand"],
      createdById: ada.id,
      circleId: null,
      comments: [
        { userId: bob.id, message: "Prenez la formule combo bao boeuf confit + frites de patate douce." },
      ],
      likedBy: [bob.id, clara.id, david.id],
      savedBy: [bob.id],
    },
    {
      title: "Quai Paisible & Sunset Spot Seine",
      description: "Rive piétonne au bord de l'eau avec vue dégagée sur les ponts illuminés à la tombée de la nuit.",
      category: SpotCategory.chill,
      visibility: SpotVisibility.circle,
      latitude: 48.8510,
      longitude: 2.3580,
      address: "Port Saint-Bernard, 75005 Paris",
      tags: ["sunset", "chill", "seine", "pique-nique"],
      createdById: clara.id,
      circleId: circleMain.id,
      comments: [
        { userId: david.id, message: "Idéal pour se retrouver en cercle autour d'un verre." },
      ],
      likedBy: [ada.id, bob.id, david.id],
      savedBy: [ada.id],
    },
    {
      title: "Mur de Bloc & Espace Slackline Plein Air",
      description: "Spot libre d'escalade et d'équilibre urbain fréquenté par des passionnés très accueillants.",
      category: SpotCategory.activity,
      visibility: SpotVisibility.public,
      latitude: 48.8520,
      longitude: 2.3780,
      address: "Bassin de l'Arsenal, 75012 Paris",
      tags: ["escalade", "slackline", "sport", "workout"],
      createdById: david.id,
      circleId: null,
      comments: [
        { userId: elena.id, message: "Sessions le samedi matin à 10h !" },
      ],
      likedBy: [elena.id, bob.id],
      savedBy: [],
    },
  ];

  for (const s of spotsData) {
    const existing = await prisma.spot.findFirst({
      where: { title: s.title, createdById: s.createdById },
    });

    const spot = existing
      ? await prisma.spot.update({
          where: { id: existing.id },
          data: {
            description: s.description,
            category: s.category,
            visibility: s.visibility,
            latitude: s.latitude,
            longitude: s.longitude,
            address: s.address,
            tags: s.tags,
            circleId: s.circleId,
          },
        })
      : await prisma.spot.create({
          data: {
            title: s.title,
            description: s.description,
            category: s.category,
            visibility: s.visibility,
            latitude: s.latitude,
            longitude: s.longitude,
            address: s.address,
            tags: s.tags,
            createdById: s.createdById,
            circleId: s.circleId,
          },
        });

    // Likes
    for (const userId of s.likedBy) {
      await prisma.spotLike.upsert({
        where: { spotId_userId: { spotId: spot.id, userId } },
        update: {},
        create: { spotId: spot.id, userId },
      });
    }

    // Saved
    for (const userId of s.savedBy) {
      await prisma.spotSaved.upsert({
        where: { spotId_userId: { spotId: spot.id, userId } },
        update: {},
        create: { spotId: spot.id, userId },
      });
    }

    // Comments
    for (const comment of s.comments) {
      const commentExists = await prisma.spotComment.findFirst({
        where: { spotId: spot.id, userId: comment.userId, message: comment.message },
      });
      if (!commentExists) {
        await prisma.spotComment.create({
          data: {
            spotId: spot.id,
            userId: comment.userId,
            message: comment.message,
          },
        });
      }
    }
  }

  // 5. Signalements de test (MapReports)
  const existingReport = await prisma.mapReport.findFirst({
    where: { circleId: circleMain.id, note: "Piste cyclable fermée pour travaux" },
  });
  if (!existingReport) {
    await prisma.mapReport.create({
      data: {
        circleId: circleMain.id,
        kind: "roadwork",
        latitude: 48.8600,
        longitude: 2.3500,
        note: "Piste cyclable fermée pour travaux",
        userId: bob.id,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
  }

  console.log("\n✅ Seed local terminé avec succès !");
  console.log("Comptes de test créés (mot de passe pour tous : %s) :", TEST_PASSWORD);
  console.log(`  - ${ada.email} (Ada Lovelace)`);
  console.log(`  - ${bob.email} (Bob Marley)`);
  console.log(`  - ${clara.email} (Clara Oswald)`);
  console.log(`  - ${david.email} (David Bowie)`);
  console.log(`  - ${elena.email} (Elena Fisher)`);
  console.log(`\nCercles de test :`);
  console.log(`  - "${circleMain.name}" (code : ${circleMain.inviteCode})`);
  console.log(`  - "${circleExplorers.name}" (code : ${circleExplorers.inviteCode})`);
  console.log(`\n${spotsData.length} pépites (spots) créées avec commentaires, likes et catégories.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
