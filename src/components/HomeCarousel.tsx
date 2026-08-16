"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getReelEntries } from "@/app/reels/actions";
import Avatar from "@/components/Avatar";
import ReelViewer from "@/components/ReelViewer";
import styles from "./HomeCarousel.module.css";
import { getActivePromotions } from "@/app/reels/actions";

type FriendReel = {
  id: string;
  name: string;
  avatarUrl: string | null;
  hasUnseen: boolean;
};

const FESTIVE_DAYS: Record<string, { title: string; sub: string }> = {
  "1-1": { title: "🎉 Happy New Year!", sub: "Wishing you a great year ahead" },
  "2-14": { title: "💗 Happy Valentine's Day", sub: "Show someone some love today" },
  "3-8": { title: "🌸 Happy Women's Day", sub: "Celebrating the women in your life" },
  "10-1": { title: "🇳🇬 Happy Independence Day", sub: "Celebrating Nigeria today" },
  "12-25": { title: "🎄 Merry Christmas", sub: "Wishing you joy and peace" },
  "12-31": { title: "✨ New Year's Eve", sub: "Here's to a great year ahead" },
};

function getFestiveSlide() {
  const now = new Date();
  const key = `${now.getMonth() + 1}-${now.getDate()}`;
  return FESTIVE_DAYS[key] || null;
}

export default function HomeCarousel({
  firstName,
  friendsReels,
  currentUserId,
  hasCommunities,
}: {
  firstName: string;
  friendsReels: FriendReel[];
  currentUserId: string;
  hasCommunities: boolean;
}) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [active, setActive] = useState<{
    name: string;
    avatarUrl: string | null;
    entries: any[];
  } | null>(null);

  const festive = getFestiveSlide();

  const [promos, setPromos] = useState<{ href: string; text: string; imageUrl: string | null }[]>([]);

  useEffect(() => {
    getActivePromotions().then(setPromos);
  }, []);

type Slide =
  | { type: "greeting" }
  | { type: "festive"; title: string; sub: string }
  | { type: "reel"; friend: FriendReel }
  | { type: "cta" }
  | { type: "promo"; href: string; text: string; imageUrl: string | null };

  const slides: Slide[] = [
    { type: "greeting" },
    ...(festive ? [{ type: "festive" as const, ...festive }] : []),
    ...friendsReels
      .filter((f) => f.hasUnseen)
      .slice(0, 3)
      .map((friend) => ({ type: "reel" as const, friend })),
    ...promos.map((p) => ({
      type: "promo" as const,
      href: p.href,
      text: p.text,
      imageUrl: p.imageUrl,
    })),
    ...(!hasCommunities ? [{ type: "cta" as const }] : []),
  ];

  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % slides.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [slides.length]);

 async function handleSlideTap(slide: Slide) {
    if (slide.type === "reel") {
      const entries = await getReelEntries(slide.friend.id);
      if (entries.length === 0) return;
      setActive({
        name: slide.friend.name,
        avatarUrl: slide.friend.avatarUrl,
        entries,
      });
    } else if (slide.type === "cta") {
      router.push("/communities");
    } else if (slide.type === "promo") {
      router.push(slide.href);
    }
  }

  return (
    <>
      <div className={styles.wrapper}>
        <div
          className={styles.track}
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {slides.map((slide, i) => {
            if (slide.type === "greeting") {
              return (
                <div key={i} className={`${styles.slide} ${styles.slideGreeting}`}>
                  <div className={styles.slideTitle}>Hey, {firstName} 👋</div>
                  <div className={styles.slideSub}>Here&apos;s what&apos;s happening</div>
                </div>
              );
            }
            if (slide.type === "festive") {
              return (
                <div key={i} className={`${styles.slide} ${styles.slideFestive}`}>
                  <div className={styles.slideTitle}>{slide.title}</div>
                  <div className={styles.slideSub}>{slide.sub}</div>
                </div>
              );
            }
            if (slide.type === "reel") {
              return (
                <div
                  key={i}
                  className={`${styles.slide} ${styles.slideReel}`}
                  onClick={() => handleSlideTap(slide)}
                >
                  <Avatar
                    name={slide.friend.name}
                    avatarUrl={slide.friend.avatarUrl}
                    size={44}
                  />
                  <div>
                    <div className={styles.slideTitle}>{slide.friend.name}</div>
                    <div className={styles.slideSub}>Tap to see their progress</div>
                  </div>
                </div>
              );
            }

            if (slide.type === "promo") {
              return (
                <div
                  key={i}
                  className={`${styles.slide} ${styles.slidePromo}`}
                  onClick={() => handleSlideTap(slide)}
                >
                  {slide.imageUrl && (
                    <img src={slide.imageUrl} className={styles.promoThumb} alt="" />
                  )}
                  <div>
                    <div className={styles.promoLabel}>Sponsored</div>
                    <div className={styles.slideTitle}>{slide.text}</div>
                  </div>
                </div>
              );
            }
            return (
              
              <div
                key={i}
                className={`${styles.slide} ${styles.slideCta}`}
                onClick={() => handleSlideTap(slide)}
              >
                <div className={styles.slideTitle}>Find your people 👥</div>
                <div className={styles.slideSub}>Explore communities to join</div>
              </div>
            );
          })}
        </div>

        {slides.length > 1 && (
          <div className={styles.dots}>
            {slides.map((_, i) => (
              <span
                key={i}
                className={`${styles.dot} ${i === index ? styles.dotActive : ""}`}
              />
            ))}
          </div>
        )}
      </div>

      {active && (
        <ReelViewer
          name={active.name}
          avatarUrl={active.avatarUrl}
          entries={active.entries}
          currentUserId={currentUserId}
          onClose={() => setActive(null)}
        />
      )}
    </>
  );
}