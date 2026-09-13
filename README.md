# WebMarket

WebMarket is a marketplace for buying and selling websites,
SaaS projects, online businesses and digital assets.

## Features

- Buyer browsing
- Seller accounts
- Seller dashboard
- Website listings
- Website screenshots
- Image uploads
- Search
- Categories
- Price filtering
- Featured listings
- Seller profiles
- Seller verification field
- Buyer-to-seller messaging
- Listing reports
- Admin moderation
- Listing approval
- Listing rejection
- Listing unpublishing
- Featured listing management
- Purchase/order foundation
- Escrow/order status foundation
- Listing fee settings
- Featured listing fee settings
- Commission settings
- Seller subscription settings
- Supabase authentication
- Supabase database
- Supabase Row Level Security
- Render deployment
- Mobile responsive design

## Setup

### 1. Create Supabase project

Create a project in Supabase.

Open the SQL Editor and run:

supabase/schema.sql

### 2. Create your account

Open the website and create your account.

### 3. Make yourself an admin

After creating your account, find your user's UUID.

Then run:

update public.profiles
set role = 'admin'
where id = 'YOUR-USER-UUID';

Replace YOUR-USER-UUID with your actual user ID.

### 4. Environment variables

Create:

.env

Use:

VITE_SUPABASE_URL=your_supabase_url

VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

### 5. GitHub

Create a GitHub repository.

Upload all project files.

### 6. Render

Connect the GitHub repository to Render.

Render will run:

npm install && npm run build

and publish:

dist

Add these environment variables:

VITE_SUPABASE_URL

VITE_SUPABASE_ANON_KEY

## Image uploads

Create a Supabase Storage bucket called:

listing-media

The application uses this bucket for listing screenshots.

## Payments

The order system is prepared for payment/escrow integration.

Do not put payment secret keys in frontend environment variables.

For real payments, add a secure server-side payment provider.

The server should handle:

- Payment creation
- Payment verification
- Webhooks
- Escrow status
- Refunds
- Commission
- Seller payouts

## Security

Never expose:

- Supabase service-role keys
- Private API keys
- Payment secret keys
- Wallet private keys
- Seed phrases
- Passwords

Only public client configuration should be exposed to the frontend.

## Production improvements

Before launching publicly, add:

- Email notifications
- CAPTCHA
- Rate limiting
- Seller verification
- Identity/business verification where appropriate
- Malware/file scanning
- Audit logs
- Full messaging inbox
- Payment provider
- Escrow provider
- Seller payouts
- Terms of service
- Privacy policy
- Refund policy
- Dispute system
- Strong server-side admin authorization