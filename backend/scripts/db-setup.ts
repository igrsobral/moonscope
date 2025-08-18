#!/usr/bin/env tsx

/**
 * Database setup script for development and testing
 * This script handles database initialization, migration, and seeding
 */

import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';


const prisma = new PrismaClient();

interface SeedCoin {
  address: string;
  symbol: string;
  name: string;
  network: string;
  contractVerified: boolean;
  logoUrl?: string;
  description?: string;
  website?: string;
  socialLinks: Record<string, string>;
}

const SEED_COINS: SeedCoin[] = [
  {
    address: '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE',
    symbol: 'SHIB',
    name: 'Shiba Inu',
    network: 'ethereum',
    contractVerified: true,
    description: 'Shiba Inu is a decentralized meme token that grew into a vibrant ecosystem.',
    website: 'https://shibatoken.com/',
    socialLinks: {
      twitter: 'https://twitter.com/Shibtoken',
      telegram: 'https://t.me/ShibaInu_Dogecoinkiller',
    },
  },
  {
    address: '0x4d224452801ACEd8B2F0aebE155379bb5D594381',
    symbol: 'APE',
    name: 'ApeCoin',
    network: 'ethereum',
    contractVerified: true,
    description: 'ApeCoin is an ERC-20 governance and utility token used within the APE ecosystem.',
    website: 'https://apecoin.com/',
    socialLinks: {
      twitter: 'https://twitter.com/apecoin',
    },
  },
  {
    address: '0x3845badAde8e6dFF049820680d1F14bD3903a5d0',
    symbol: 'SAND',
    name: 'The Sandbox',
    network: 'ethereum',
    contractVerified: true,
    description: 'The Sandbox is a virtual gaming world where players can build, own, and monetize their gaming experiences.',
    website: 'https://www.sandbox.game/',
    socialLinks: {
      twitter: 'https://twitter.com/TheSandboxGame',
      telegram: 'https://t.me/sandboxgame',
    },
  },
  {
    address: '0x50D1c9771902476076eCFc8B2A83Ad6b9355a4c9',
    symbol: 'FTT',
    name: 'FTX Token',
    network: 'ethereum',
    contractVerified: true,
    description: 'FTX Token is the native token of the FTX cryptocurrency exchange.',
    website: 'https://ftx.com/',
    socialLinks: {
      twitter: 'https://twitter.com/FTX_Official',
    },
  },
  {
    address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
    symbol: 'UNI',
    name: 'Uniswap',
    network: 'ethereum',
    contractVerified: true,
    description: 'Uniswap is a decentralized protocol for automated liquidity provision on Ethereum.',
    website: 'https://uniswap.org/',
    socialLinks: {
      twitter: 'https://twitter.com/Uniswap',
    },
  },
];

async function runMigrations() {
  console.log('🔄 Running database migrations...');
  try {
    execSync('npx prisma migrate dev --name init', { 
      stdio: 'inherit',
      cwd: process.cwd(),
    });
    console.log('✅ Database migrations completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

async function generatePrismaClient() {
  console.log('🔄 Generating Prisma client...');
  try {
    execSync('npx prisma generate', { 
      stdio: 'inherit',
      cwd: process.cwd(),
    });
    console.log('✅ Prisma client generated successfully');
  } catch (error) {
    console.error('❌ Prisma client generation failed:', error);
    throw error;
  }
}

async function seedDatabase() {
  console.log('🌱 Seeding database with initial data...');
  
  try {
    // Create seed coins
    for (const coinData of SEED_COINS) {
      const coin = await prisma.coin.upsert({
        where: { address: coinData.address },
        update: coinData,
        create: coinData,
      });
      
      console.log(`📊 Created/updated coin: ${coin.symbol} (${coin.name})`);
      
      // Add some sample price data
      const now = new Date();
      const basePrice = Math.random() * 100 + 1; // Random price between 1-101
      
      await prisma.priceData.create({
        data: {
          coinId: coin.id,
          price: basePrice,
          marketCap: BigInt(Math.floor(basePrice * 1000000000)), // Mock market cap
          volume24h: BigInt(Math.floor(basePrice * 10000000)), // Mock volume
          liquidity: BigInt(Math.floor(basePrice * 5000000)), // Mock liquidity
          priceChange24h: (Math.random() - 0.5) * 20, // Random change between -10% to +10%
          volumeChange24h: (Math.random() - 0.5) * 50, // Random volume change
          timestamp: now,
        },
      });
      
      await prisma.riskAssessment.create({
        data: {
          coinId: coin.id,
          overallScore: Math.floor(Math.random() * 100) + 1,
          liquidityScore: Math.floor(Math.random() * 100) + 1,
          holderDistributionScore: Math.floor(Math.random() * 100) + 1,
          contractSecurityScore: coinData.contractVerified ? 85 + Math.floor(Math.random() * 15) : Math.floor(Math.random() * 50),
          socialScore: Math.floor(Math.random() * 100) + 1,
          factors: {
            liquidity: {
              score: Math.floor(Math.random() * 100) + 1,
              value: Number(basePrice * 5000000),
              threshold: 1000000,
            },
            holderDistribution: {
              score: Math.floor(Math.random() * 100) + 1,
              topHoldersPercentage: Math.random() * 50 + 10,
              holderCount: Math.floor(Math.random() * 50000) + 1000,
            },
            contractSecurity: {
              score: coinData.contractVerified ? 85 + Math.floor(Math.random() * 15) : Math.floor(Math.random() * 50),
              isVerified: coinData.contractVerified,
              hasProxyContract: Math.random() > 0.5,
              hasOwnershipRenounced: Math.random() > 0.3,
            },
            socialMetrics: {
              score: Math.floor(Math.random() * 100) + 1,
              sentimentScore: (Math.random() - 0.5) * 2, // -1 to 1
              communitySize: Math.floor(Math.random() * 100000) + 1000,
            },
          },
          timestamp: now,
        },
      });
      
      const platforms = ['twitter', 'reddit', 'telegram'];
      for (const platform of platforms) {
        await prisma.socialMetrics.create({
          data: {
            coinId: coin.id,
            platform,
            followers: Math.floor(Math.random() * 1000000) + 1000,
            mentions24h: Math.floor(Math.random() * 1000) + 10,
            sentimentScore: (Math.random() - 0.5) * 2, // -1 to 1
            trendingScore: Math.random() * 100,
            influencerMentions: Math.floor(Math.random() * 50),
            timestamp: now,
          },
        });
      }
    }
    
    console.log('✅ Database seeded successfully');
  } catch (error) {
    console.error('❌ Database seeding failed:', error);
    throw error;
  }
}

async function createTestUser() {
  console.log('👤 Creating test user...');
  
  try {
    const testUser = await prisma.user.upsert({
      where: { walletAddress: '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6' },
      update: {},
      create: {
        walletAddress: '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6',
        email: 'test@example.com',
        preferences: {
          notifications: {
            email: true,
            push: true,
            sms: false,
          },
          defaultCurrency: 'USD',
          theme: 'dark',
          riskTolerance: 'medium',
        },
      },
    });
    
    console.log(`✅ Test user created: ${testUser.walletAddress}`);
    
    const coins = await prisma.coin.findMany({ take: 3 });
    
    for (const coin of coins) {
      await prisma.portfolio.upsert({
        where: {
          userId_coinId: {
            userId: testUser.id,
            coinId: coin.id,
          },
        },
        update: {},
        create: {
          userId: testUser.id,
          coinId: coin.id,
          amount: Math.random() * 1000 + 100,
          avgPrice: Math.random() * 10 + 0.1,
        },
      });
    }
    
    console.log('📈 Test portfolio entries created');
  } catch (error) {
    console.error('❌ Test user creation failed:', error);
    throw error;
  }
}

async function main() {
  console.log('🚀 Starting database setup...\n');
  
  try {
    const shouldMigrate = process.argv.includes('--migrate');
    const shouldSeed = process.argv.includes('--seed') || process.argv.includes('--all');
    const shouldGenerate = process.argv.includes('--generate');
    
    if (shouldMigrate || process.argv.includes('--all')) {
      await runMigrations();
    }
    
    if (shouldGenerate || process.argv.includes('--all')) {
      await generatePrismaClient();
    }
    
    if (shouldSeed || process.argv.includes('--all')) {
      await seedDatabase();
      await createTestUser();
    }
    
    if (!shouldMigrate && !shouldSeed && !shouldGenerate) {
      console.log('ℹ️  No specific action requested. Use:');
      console.log('  --migrate    Run database migrations');
      console.log('  --generate   Generate Prisma client');
      console.log('  --seed       Seed database with sample data');
      console.log('  --all        Run all operations');
    }
    
    console.log('\n✅ Database setup completed successfully!');
  } catch (error) {
    console.error('\n❌ Database setup failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});