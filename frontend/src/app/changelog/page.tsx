"use client";

import Breadcrumb from "@/components/Breadcrumb/Breadcrumb";
import Loader from "@/components/Loader";
import {
  ClockIcon,
  CodeBracketIcon,
  RocketLaunchIcon,
  UserIcon,
} from "@heroicons/react/24/outline";
import { useEffect, useState } from "react";

interface Commit {
  sha: string;
  commit: {
    message: string;
    author: {
      name: string;
      date: string;
    };
  };
  html_url: string;
}

interface Release {
  tag_name: string;
  name: string;
  body: string;
  published_at: string;
  html_url: string;
  author: {
    login: string;
  };
}

interface ChangelogData {
  releases: Release[];
  commits: Commit[];
}

const getCommitType = (message: string) => {
  const lowerMsg = message.toLowerCase();
  if (lowerMsg.startsWith("feat:") || lowerMsg.includes("feature"))
    return { type: "feature", color: "text-green-400", bg: "bg-green-500/10" };
  if (lowerMsg.startsWith("fix:") || lowerMsg.includes("fix"))
    return { type: "fix", color: "text-red-400", bg: "bg-red-500/10" };
  if (lowerMsg.startsWith("docs:") || lowerMsg.includes("documentation"))
    return { type: "docs", color: "text-blue-400", bg: "bg-blue-500/10" };
  if (
    lowerMsg.startsWith("refactor:") ||
    lowerMsg.startsWith("perf:") ||
    lowerMsg.includes("optimize")
  )
    return {
      type: "refactor",
      color: "text-purple-400",
      bg: "bg-purple-500/10",
    };
  return { type: "chore", color: "text-gray-400", bg: "bg-gray-500/10" };
};

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

  if (diffInHours < 24) {
    return `${Math.floor(diffInHours)} hours ago`;
  } else if (diffInHours < 48) {
    return "Yesterday";
  } else if (diffInHours < 168) {
    return `${Math.floor(diffInHours / 24)} days ago`;
  } else {
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }
};

const getDateGroup = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const commitDate = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );

  if (commitDate.getTime() === today.getTime()) {
    return "Today";
  } else if (commitDate.getTime() === yesterday.getTime()) {
    return "Yesterday";
  } else {
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }
};

const groupCommitsByDate = (commits: Commit[]) => {
  const groups: { [key: string]: Commit[] } = {};

  commits.forEach((commit) => {
    const dateGroup = getDateGroup(commit.commit.author.date);
    if (!groups[dateGroup]) {
      groups[dateGroup] = [];
    }
    groups[dateGroup].push(commit);
  });

  // Sort groups by most recent first
  const sortedGroups: { [key: string]: Commit[] } = {};
  const sortedKeys = Object.keys(groups).sort((a, b) => {
    // Today and Yesterday should be at the top
    if (a === "Today") return -1;
    if (b === "Today") return 1;
    if (a === "Yesterday") return -1;
    if (b === "Yesterday") return 1;
    // Other dates compared chronologically
    return new Date(b).getTime() - new Date(a).getTime();
  });

  sortedKeys.forEach((key) => {
    sortedGroups[key] = groups[key];
  });

  return sortedGroups;
};

export default function ChangelogPage() {
  const [data, setData] = useState<ChangelogData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchChangelog = async () => {
      try {
        const [releasesRes, commitsRes] = await Promise.all([
          fetch(
            "https://api.github.com/repos/umutyerebakmaz/killreport/releases",
          ),
          fetch(
            "https://api.github.com/repos/umutyerebakmaz/killreport/commits?per_page=30",
          ),
        ]);

        if (!releasesRes.ok || !commitsRes.ok) {
          throw new Error("Failed to fetch changelog data");
        }

        const releases = await releasesRes.json();
        const commits = await commitsRes.json();

        setData({ releases, commits });
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    };

    fetchChangelog();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Loader />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto">
        <Breadcrumb items={[{ label: "Changelog", href: "/changelog" }]} />
        <div className="p-6 mt-8 border bg-neutral-900 border-neutral-700">
          <h2 className="mb-2 text-xl font-bold text-red-400">
            Failed to load changelog
          </h2>
          <p className="text-gray-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto">
      <Breadcrumb items={[{ label: "Changelog", href: "/changelog" }]} />

      {/* Header */}
      <div className="mt-8 mb-12">
        <div className="flex items-center gap-3 mb-4">
          <RocketLaunchIcon className="w-10 h-10 text-blue-400" />
          <h1 className="text-4xl font-bold text-white">Changelog</h1>
        </div>
        <p className="text-lg text-gray-400">
          Track the latest updates, features, and improvements to KillReport
        </p>
      </div>

      {/* Recent Commits */}
      <section className="mb-16">
        <h2 className="flex items-center gap-2 mb-6 text-2xl font-semibold text-white">
          <ClockIcon className="w-6 h-6 text-blue-400" />
          Recent Updates
        </h2>

        {!data?.commits || data.commits.length === 0 ? (
          <div className="p-8 text-center border border-white/10 bg-neutral-900">
            <p className="text-gray-400">No recent commits available</p>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(groupCommitsByDate(data.commits.slice(0, 30))).map(
              ([dateGroup, commits]) => (
                <div key={dateGroup}>
                  {/* Date Header */}
                  <div className="mb-3">
                    <h3 className="text-lg font-semibold text-gray-300">
                      {dateGroup}
                    </h3>
                  </div>

                  {/* Commits for this date */}
                  <div className="overflow-hidden border divide-y rounded-lg border-white/10 bg-neutral-900 divide-white/5">
                    {commits.map((commit) => {
                      const commitInfo = getCommitType(commit.commit.message);
                      const firstLine = commit.commit.message.split("\n")[0];

                      return (
                        <div
                          key={commit.sha}
                          className="p-4 transition-colors hover:bg-neutral-800"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <span
                                  className={`px-2 py-0.5 ${commitInfo.bg} ${commitInfo.color} text-xs font-semibold uppercase`}
                                >
                                  {commitInfo.type}
                                </span>
                                <a
                                  href={commit.html_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-mono text-xs text-gray-500 hover:text-gray-400"
                                >
                                  {commit.sha.substring(0, 7)}
                                </a>
                              </div>
                              <a
                                href={commit.html_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block mb-2 text-gray-200 transition-colors hover:text-blue-400"
                              >
                                {firstLine}
                              </a>
                              <div className="flex items-center gap-3 text-xs text-gray-400">
                                <span className="flex items-center gap-1">
                                  <UserIcon className="w-3 h-3" />
                                  {commit.commit.author.name}
                                </span>
                                <span className="flex items-center gap-1">
                                  <ClockIcon className="w-3 h-3" />
                                  {new Date(
                                    commit.commit.author.date,
                                  ).toLocaleTimeString("en-US", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ),
            )}
        </div>
      </section>

      {/* Releases Section */}
      {data?.releases && data.releases.length > 0 && (
        <section className="mb-16">
          <h2 className="flex items-center gap-2 mb-6 text-2xl font-semibold text-white">
            <CodeBracketIcon className="w-6 h-6 text-green-400" />
            Releases
          </h2>

          <div className="overflow-hidden border divide-y rounded-lg border-white/10 bg-neutral-900 divide-white/5">
            {data.releases.map((release) => (
              <div
                key={release.tag_name}
                className="p-6 transition-colors hover:bg-neutral-800"
              >
                <div className="mb-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-3 py-1 text-sm font-semibold text-green-400 bg-green-500/20">
                      {release.tag_name}
                    </span>
                    <span className="text-sm text-gray-500">
                      {formatDate(release.published_at)}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-white">
                    {release.name || release.tag_name}
                  </h3>
                </div>

                <a
                  href={release.html_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-400 transition-colors hover:text-blue-300"
                >
                  View on GitHub →
                </a>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Footer Note */}
      <p className="mt-12 text-sm text-center text-gray-400">
        Data is fetched from{" "}
        <a
          href="https://github.com/umutyerebakmaz/killreport"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 hover:text-blue-300"
        >
          GitHub repository
        </a>{" "}
        in real-time
      </p>
    </div>
  );
}
