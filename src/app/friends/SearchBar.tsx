"use client";

import { useState } from "react";
import { searchUsers, sendFriendRequest } from "./actions";
import Avatar from "@/components/Avatar";
import styles from "./page.module.css";
import { Search } from "lucide-react";

type Profile = {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

export default function SearchBar() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  const [sentTo, setSentTo] = useState<string[]>([]);

  async function handleSearch() {
    const data = await searchUsers(query);
    setResults(data);
  }

  async function handleAdd(id: string) {
    const result = await sendFriendRequest(id);
    if (result.success) {
      setSentTo((prev) => [...prev, id]);
    }
  }

  return (
    <div>
      <div className={styles.searchBox}>
        <input
          className={styles.searchInput}
          placeholder="Search by name or email"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
        />
        <button className={styles.searchBtn} onClick={handleSearch}>
          <Search size={16} />
        </button>
      </div>

      {results.map((profile) => (
        <div key={profile.id} className={styles.row}>
          <div className={styles.rowLeft}>
            <Avatar
              name={profile.full_name || "?"}
              avatarUrl={profile.avatar_url}
              size={40}
            />
            <div>
             <div className={styles.name}>{profile.full_name || "Unnamed"}</div>
            <div className={styles.email}>
              {profile.username ? `@${profile.username}` : "No username set"}
            </div>
            </div>
          </div>
          <button
            className={styles.addBtn}
            onClick={() => handleAdd(profile.id)}
            disabled={sentTo.includes(profile.id)}
          >
            {sentTo.includes(profile.id) ? "Sent" : "Add"}
          </button>
        </div>
      ))}
    </div>
  );
}