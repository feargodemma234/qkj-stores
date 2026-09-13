import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { createClient } from "@supabase/supabase-js";
import "./styles.css";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);

  const [page, setPage] = useState("home");
  const [listings, setListings] = useState([]);
  const [categories, setCategories] = useState([]);

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [maxPrice, setMaxPrice] = useState("");

  const [selected, setSelected] = useState(null);
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    loadMarketplace();
  }, [session]);

  async function loadMarketplace() {
    if (!supabase) {
      setListings([]);
      return;
    }

    const { data: categoryData } = await supabase
      .from("categories")
      .select("*")
      .order("name");

    setCategories(categoryData || []);

    const { data: listingData, error } = await supabase
      .from("listings")
      .select(
        `
        *,
        profiles(display_name, verified),
        categories(name)
      `
      )
      .order("featured", { ascending: false })
      .order("created_at", { ascending: false });

    if (!error) {
      setListings(listingData || []);
    }

    if (session?.user?.id) {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();

      setProfile(profileData);
    }
  }

  const visibleListings = useMemo(() => {
    return listings.filter((listing) => {
      const allowed =
        listing.status === "approved" ||
        listing.seller_id === session?.user?.id ||
        profile?.role === "admin";

      if (!allowed) return false;

      const text =
        `${listing.title} ${listing.domain || ""} ${
          listing.description || ""
        }`.toLowerCase();

      if (query && !text.includes(query.toLowerCase())) {
        return false;
      }

      if (category && listing.categories?.name !== category) {
        return false;
      }

      if (maxPrice && Number(listing.price) > Number(maxPrice)) {
        return false;
      }

      return true;
    });
  }, [
    listings,
    query,
    category,
    maxPrice,
    session,
    profile,
  ]);

  async function loginOrSignup() {
    if (!supabase) return;

    const email = prompt("Enter your email:");
    if (!email) return;

    const password = prompt(
      "Enter your password (minimum 6 characters):"
    );

    if (!password) return;

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      const signup = await supabase.auth.signUp({
        email,
        password,
      });

      if (signup.error) {
        alert(signup.error.message);
      } else {
        alert(
          "Account created. Check your email if email confirmation is enabled."
        );
      }
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    setProfile(null);
    setPage("home");
  }

  async function createListing(event) {
    event.preventDefault();

    if (!session) {
      alert("Please log in first.");
      return;
    }

    const form = new FormData(event.currentTarget);

    const listing = {
      seller_id: session.user.id,
      title: form.get("title"),
      domain: form.get("domain"),
      description: form.get("description"),
      price: Number(form.get("price") || 0),
      currency: form.get("currency") || "USD",
      traffic_monthly: Number(form.get("traffic") || 0),
      revenue_monthly: Number(form.get("revenue") || 0),
      profit_monthly: Number(form.get("profit") || 0),
      image_url: form.get("image") || null,
      status: "pending",
    };

    const { error } = await supabase
      .from("listings")
      .insert(listing);

    if (error) {
      alert(error.message);
      return;
    }

    alert("Listing submitted for admin approval.");

    event.currentTarget.reset();

    await loadMarketplace();
    setPage("seller");
  }

  async function uploadImage(file) {
    if (!file || !session) return null;

    const safeName = file.name.replace(
      /[^a-zA-Z0-9._-]/g,
      "_"
    );

    const path = `${session.user.id}/${Date.now()}-${safeName}`;

    const { error } = await supabase.storage
      .from("listing-media")
      .upload(path, file);

    if (error) {
      alert("Image upload failed: " + error.message);
      return null;
    }

    const { data } = supabase.storage
      .from("listing-media")
      .getPublicUrl(path);

    return data.publicUrl;
  }

  async function messageSeller(listing) {
    if (!session) {
      await loginOrSignup();
      return;
    }

    const body = prompt("Write your message:");

    if (!body) return;

    const { error } = await supabase
      .from("messages")
      .insert({
        listing_id: listing.id,
        sender_id: session.user.id,
        recipient_id: listing.seller_id,
        body,
      });

    if (error) {
      alert(error.message);
    } else {
      showToast("Message sent.");
    }
  }

  async function reportListing(listing) {
    if (!session) {
      await loginOrSignup();
      return;
    }

    const reason = prompt("Why are you reporting this listing?");

    if (!reason) return;

    const { error } = await supabase
      .from("reports")
      .insert({
        listing_id: listing.id,
        reporter_id: session.user.id,
        reason,
      });

    if (error) {
      alert(error.message);
    } else {
      showToast("Report submitted.");
    }
  }

  async function startPurchase(listing) {
    if (!session) {
      await loginOrSignup();
      return;
    }

    const { error } = await supabase
      .from("orders")
      .insert({
        listing_id: listing.id,
        buyer_id: session.user.id,
        seller_id: listing.seller_id,
        amount: listing.price,
        currency: listing.currency,
        status: "pending",
      });

    if (error) {
      alert(error.message);
    } else {
      showToast(
        "Purchase request created. Payment/escrow must be connected before funds move."
      );
    }
  }

  async function adminAction(id, changes) {
    const { error } = await supabase
      .from("listings")
      .update(changes)
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    await loadMarketplace();
  }

  function showToast(message) {
    setToast(message);

    setTimeout(() => {
      setToast("");
    }, 3000);
  }

  if (!supabase) {
    return (
      <Shell>
        <main className="dashboard">
          <h1>Connect Supabase</h1>

          <p>
            Add your Supabase URL and anonymous key to your
            environment variables.
          </p>
        </main>
      </Shell>
    );
  }

  return (
    <Shell>
      <header>
        <div
          className="brand"
          onClick={() => setPage("home")}
        >
          WebMarket
        </div>

        <nav>
          <button onClick={() => setPage("home")}>
            Browse
          </button>

          {session && (
            <button onClick={() => setPage("seller")}>
              Seller Dashboard
            </button>
          )}

          {profile?.role === "admin" && (
            <button onClick={() => setPage("admin")}>
              Admin
            </button>
          )}

          {!session ? (
            <button
              className="primary"
              onClick={loginOrSignup}
            >
              Login / Sign up
            </button>
          ) : (
            <button onClick={logout}>
              Sign out
            </button>
          )}
        </nav>
      </header>

      {toast && (
        <div
          className="toast"
          onClick={() => setToast("")}
        >
          {toast}
        </div>
      )}

      {page === "home" && (
        <>
          <section className="hero">
            <h1>Buy & sell websites.</h1>

            <p>
              Discover established websites, SaaS projects,
              content businesses and online assets.
            </p>

            <div className="search">
              <input
                placeholder="Search websites, domains, niches..."
                value={query}
                onChange={(event) =>
                  setQuery(event.target.value)
                }
              />

              <select
                value={category}
                onChange={(event) =>
                  setCategory(event.target.value)
                }
              >
                <option value="">All categories</option>

                {categories.map((item) => (
                  <option key={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>

              <input
                type="number"
                placeholder="Max price"
                value={maxPrice}
                onChange={(event) =>
                  setMaxPrice(event.target.value)
                }
              />
            </div>
          </section>

          <section className="grid">
            {visibleListings.map((listing) => (
              <article
                className="card"
                key={listing.id}
                onClick={() => setSelected(listing)}
              >
                {listing.image_url ? (
                  <img
                    src={listing.image_url}
                    alt={listing.title}
                  />
                ) : (
                  <div className="placeholder">
                    WEBSITE
                  </div>
                )}

                <div className="pad">
                  {listing.featured && (
                    <span className="tag">
                      FEATURED
                    </span>
                  )}

                  <h3>{listing.title}</h3>

                  <p className="muted">
                    {listing.domain ||
                      "Domain not provided"}
                  </p>

                  <p>
                    {(listing.description || "").slice(
                      0,
                      120
                    )}
                  </p>

                  <div className="stats">
                    <b>
                      $
                      {Number(
                        listing.price
                      ).toLocaleString()}
                    </b>

                    <span>
                      {Number(
                        listing.traffic_monthly
                      ).toLocaleString()}{" "}
                      visits/mo
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </section>
        </>
      )}

      {page === "seller" && (
        <SellerDashboard
          session={session}
          listings={listings.filter(
            (listing) =>
              listing.seller_id === session?.user?.id
          )}
          onSave={createListing}
          uploadImage={uploadImage}
        />
      )}

      {page === "admin" && profile?.role === "admin" && (
        <AdminDashboard
          listings={listings}
          onAction={adminAction}
        />
      )}

      {selected && (
        <Modal>
          <button
            className="close"
            onClick={() => setSelected(null)}
          >
            ×
          </button>

          <h2>{selected.title}</h2>

          <p className="muted">
            {selected.domain}
          </p>

          {selected.image_url && (
            <img
              className="detailImg"
              src={selected.image_url}
              alt={selected.title}
            />
          )}

          <p>{selected.description}</p>

          <div className="detailGrid">
            <div>
              Price
              <br />
              <b>
                ${Number(selected.price).toLocaleString()}
              </b>
            </div>

            <div>
              Traffic
              <br />
              <b>
                {Number(
                  selected.traffic_monthly
                ).toLocaleString()}
                /mo
              </b>
            </div>

            <div>
              Revenue
              <br />
              <b>
                $
                {Number(
                  selected.revenue_monthly
                ).toLocaleString()}
                /mo
              </b>
            </div>

            <div>
              Seller
              <br />
              <b>
                {selected.profiles?.display_name ||
                  "Seller"}
              </b>
            </div>
          </div>

          <button
            className="primary full"
            onClick={() => messageSeller(selected)}
          >
            Message seller
          </button>

          <button
            className="full"
            onClick={() => startPurchase(selected)}
          >
            Start purchase
          </button>

          <button
            className="link"
            onClick={() => reportListing(selected)}
          >
            Report listing
          </button>
        </Modal>
      )}
    </Shell>
  );
}

function SellerDashboard({
  session,
  listings,
  onSave,
  uploadImage,
}) {
  const [uploadedImage, setUploadedImage] =
    useState("");

  async function handleFile(event) {
    const file = event.target.files?.[0];

    if (!file) return;

    const url = await uploadImage(file);

    if (url) {
      setUploadedImage(url);
    }
  }

  function submit(event) {
    const form = event.currentTarget;

    if (
      uploadedImage &&
      !form.querySelector('[name="uploadedImage"]')
    ) {
      const hidden = document.createElement("input");

      hidden.type = "hidden";
      hidden.name = "image";
      hidden.value = uploadedImage;

      form.appendChild(hidden);
    }

    onSave(event);
  }

  return (
    <main className="dashboard">
      <h1>Seller Dashboard</h1>

      <div className="metrics">
        <div>
          <b>{listings.length}</b>
          <span>Listings</span>
        </div>

        <div>
          <b>
            {
              listings.filter(
                (item) => item.status === "approved"
              ).length
            }
          </b>
          <span>Approved</span>
        </div>

        <div>
          <b>
            {
              listings.filter(
                (item) => item.featured
              ).length
            }
          </b>
          <span>Featured</span>
        </div>
      </div>

      <form
        onSubmit={submit}
        className="form"
      >
        <h2>New Listing</h2>

        <input
          required
          name="title"
          placeholder="Website title"
        />

        <input
          name="domain"
          placeholder="Domain — example.com"
        />

        <textarea
          required
          name="description"
          placeholder="Describe the website, niche, technology, reason for sale and included assets..."
        />

        <div className="two">
          <input
            required
            type="number"
            name="price"
            placeholder="Price"
          />

          <select name="currency">
            <option>USD</option>
            <option>NGN</option>
            <option>EUR</option>
          </select>
        </div>

        <div className="three">
          <input
            type="number"
            name="traffic"
            placeholder="Monthly traffic"
          />

          <input
            type="number"
            name="revenue"
            placeholder="Monthly revenue"
          />

          <input
            type="number"
            name="profit"
            placeholder="Monthly profit"
          />
        </div>

        <input
          name="image"
          placeholder="Main image URL"
        />

        <label>
          Or upload a screenshot
          <input
            type="file"
            accept="image/*"
            onChange={handleFile}
          />
        </label>

        {uploadedImage && (
          <small>
            Image uploaded successfully.
          </small>
        )}

        <button className="primary">
          Submit for approval
        </button>
      </form>

      <h2>Your Listings</h2>

      <div className="list">
        {listings.map((listing) => (
          <div
            className="row"
            key={listing.id}
          >
            <b>{listing.title}</b>
            <span>{listing.status}</span>
            <span>${listing.price}</span>
          </div>
        ))}
      </div>
    </main>
  );
}

function AdminDashboard({
  listings,
  onAction,
}) {
  return (
    <main className="dashboard">
      <h1>Admin Dashboard</h1>

      <div className="metrics">
        <div>
          <b>{listings.length}</b>
          <span>Total listings</span>
        </div>

        <div>
          <b>
            {
              listings.filter(
                (item) => item.status === "pending"
              ).length
            }
          </b>
          <span>Pending review</span>
        </div>

        <div>
          <b>
            {
              listings.filter(
                (item) => item.featured
              ).length
            }
          </b>
          <span>Featured</span>
        </div>
      </div>

      <div className="list">
        {listings.map((listing) => (
          <div
            className="adminRow"
            key={listing.id}
          >
            <div>
              <b>{listing.title}</b>

              <small>
                {listing.domain} · $
                {listing.price} ·{" "}
                {listing.status}
              </small>
            </div>

            <div className="actions">
              {listing.status !== "approved" && (
                <button
                  onClick={() =>
                    onAction(listing.id, {
                      status: "approved",
                    })
                  }
                >
                  Approve
                </button>
              )}

              <button
                onClick={() =>
                  onAction(listing.id, {
                    status: "unpublished",
                  })
                }
              >
                Unpublish
              </button>

              <button
                onClick={() =>
                  onAction(listing.id, {
                    featured: !listing.featured,
                  })
                }
              >
                {listing.featured
                  ? "Unfeature"
                  : "Feature"}
              </button>

              <button
                className="danger"
                onClick={() =>
                  onAction(listing.id, {
                    status: "rejected",
                  })
                }
              >
                Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}

function Modal({ children }) {
  return (
    <div className="overlay">
      <div className="modal">
        {children}
      </div>
    </div>
  );
}

function Shell({ children }) {
  return (
    <div className="app">
      {children}

      <footer>
        WebMarket · React + Supabase
      </footer>
    </div>
  );
}

createRoot(
  document.getElementById("root")
).render(<App />);