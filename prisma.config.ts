import { defineConfig } from 'prisma/config';
import { PrismaD1 } from '@prisma/adapter-d1';

// import your .env file
import 'dotenv/config';

export default defineConfig({
	schema: 'prisma/schema.prisma',
	migrate: {
		async adapter() {
			return new PrismaD1({
				CLOUDFLARE_D1_TOKEN: process.env.CLOUDFLARE_D1_TOKEN!,
				CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID!,
				CLOUDFLARE_DATABASE_ID: process.env.CLOUDFLARE_DATABASE_ID!,
			});
		},
	},
});
