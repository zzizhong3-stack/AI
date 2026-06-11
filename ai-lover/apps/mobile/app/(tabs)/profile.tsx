import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getMe, getMyProfile, getUsData, getStoredNickname, logout, UserProfileData, UsData, MemoryItem, TimelineItem, PerspectiveItem } from "../../src/services/api";
import { User } from "../../src/types";
import { useRouter } from "expo-router";

export default function ProfileScreen() {
  const [user, setUser] = useState<User | null>(null);
  const [data, setData] = useState<UserProfileData | null>(null);
  const [us, setUs] = useState<UsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [nickname, setNickname] = useState("");
  const [tab, setTab] = useState<"memories" | "us">("memories");
  const [subTab, setSubTab] = useState<"facts" | "inferences" | "events">("facts");
  const router = useRouter();

  useEffect(() => {
    Promise.all([
      getMe().catch(() => null),
      getMyProfile().catch(() => null),
      getUsData().catch(() => null),
      getStoredNickname(),
    ])
      .then(([u, p, usData, storedNick]) => {
        if (u) setUser(u.user);
        setData(p);
        setUs(usData);
        if (storedNick) setNickname(storedNick);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleLogout = () => {
    Alert.alert("退出确认", "退出后需要重新输入昵称。确定吗？", [
      { text: "取消", style: "cancel" },
      {
        text: "确定退出",
        style: "destructive",
        onPress: async () => {
          await logout();
          // 重启应用 — 通过导航到根路由让 _layout 重新检查
          router.replace("/");
          // 简单的强制刷新方式
          setUser(null);
          setData(null);
          setUs(null);
          setNickname("");
        },
      },
    ]);
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#e91e63" /></View>;
  }

  const displayName = user?.nickname || nickname || "我";
  const hasMemory = data && data.facts.length > 0;
  const hasUs = us && us.timeline.length > 0;

  return (
    <ScrollView style={styles.container}>
      {/* 用户卡片 */}
      <View style={styles.userCard}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{displayName.slice(0, 1)}</Text></View>
        <Text style={styles.nickname}>{displayName}</Text>
        {data?.preferences?.call_name && (
          <Text style={styles.callName}>Jinceia 叫我「{data.preferences.call_name}」</Text>
        )}
      </View>

      {/* 顶层 Tab：记忆 / 我们 */}
      <View style={styles.topTabs}>
        <Tab label="她的记忆" active={tab === "memories"} onPress={() => setTab("memories")} />
        <Tab label="我们" active={tab === "us"} onPress={() => setTab("us")} />
      </View>

      {tab === "memories" && (
        <>
          {!hasMemory ? (
            <GuideBlock icon="🤍" title="去和 Jinceia 聊聊天吧" text="聊过之后，这里会出现她对你的了解。" />
          ) : (
            <>
              {/* 记忆子标签 */}
              <View style={styles.subTabs}>
                <SubTab label={`事实 (${data!.facts.length})`} active={subTab === "facts"} onPress={() => setSubTab("facts")} />
                <SubTab label={`理解 (${data!.inferences.length})`} active={subTab === "inferences"} onPress={() => setSubTab("inferences")} />
                <SubTab label={`事件 (${data!.events.length})`} active={subTab === "events"} onPress={() => setSubTab("events")} />
              </View>
              {subTab === "facts" && <FactsList facts={data!.facts} />}
              {subTab === "inferences" && <InferencesList inferences={data!.inferences} />}
              {subTab === "events" && <EventsList events={data!.events} />}
            </>
          )}
        </>
      )}

      {tab === "us" && (
        <>
          {!hasUs ? (
            <GuideBlock icon="💜" title="你们的故事还没开始" text="多聊几次，共同历史会慢慢积累。" />
          ) : (
            <>
              {/* 关系概览 */}
              <View style={styles.overview}>
                <Text style={styles.sectionTitle}>关系概览</Text>
                <View style={styles.overviewGrid}>
                  <Stat label="共同记忆" value={us!.overview.total_memories} />
                  <Stat label="时间节点" value={us!.overview.total_timeline_events} />
                  <Stat label="她的日记" value={us!.overview.total_jinceia_perspectives} />
                  <Stat label="对话次数" value={us!.overview.total_conversations} />
                </View>
              </View>

              {/* 她的日记 */}
              {us!.perspectives.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>💜 她的日记</Text>
                  <Text style={styles.sectionHint}>这些是 Jinceia 对自己的记录。只有你能看到。</Text>
                  {us!.perspectives.map((p) => (
                    <View key={p.id} style={styles.diaryCard}>
                      <Text style={styles.diaryDate}>{p.date}</Text>
                      <Text style={styles.diaryText}>{p.narrative}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* 共同时间线 */}
              {us!.timeline.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>📅 共同时间线</Text>
                  {us!.timeline.map((e) => (
                    <View key={e.id} style={styles.tlItem}>
                      <View style={styles.tlDot} />
                      <View style={styles.tlCard}>
                        <Text style={styles.tlDate}>{e.date}</Text>
                        <Text style={styles.tlTitle}>{e.title}</Text>
                        <Text style={styles.tlDesc}>{e.description}</Text>
                        {e.perspective === "jinceia" && <Text style={styles.tlBadge}>她的视角</Text>}
                        {e.perspective === "shared" && <Text style={[styles.tlBadge, { color: "#4caf50" }]}>共同经历</Text>}
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </>
          )}
        </>
      )}

      {/* 菜单 */}
      <View style={styles.menuSection}>
        <TouchableOpacity style={styles.menuItem} onPress={handleLogout} activeOpacity={0.6}>
          <Ionicons name="log-out" size={22} color="#ff5252" style={{ marginRight: 12 }} />
          <View style={{ flex: 1 }}><Text style={[styles.menuLabel, { color: "#ff5252" }]}>退出登录</Text><Text style={styles.menuSub}>切换身份</Text></View>
        </TouchableOpacity>
        <MenuItem icon="information-circle" label="关于" subtitle="v0.4.0 — 关系阶段" />
      </View>
      <Text style={styles.footer}>AI Lover v0.4.0</Text>
    </ScrollView>
  );
}

// ===== 子组件 =====

function GuideBlock({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <View style={styles.guide}>
      <Text style={styles.guideIcon}>{icon}</Text>
      <Text style={styles.guideTitle}>{title}</Text>
      <Text style={styles.guideText}>{text}</Text>
    </View>
  );
}

function Tab({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.tab, active && styles.tabActive]} onPress={onPress} activeOpacity={0.6}>
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function SubTab({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.subTab, active && styles.subTabActive]} onPress={onPress} activeOpacity={0.6}>
      <Text style={[styles.subTabText, active && styles.subTabTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function FactsList({ facts }: { facts: MemoryItem[] }) {
  return (
    <View style={styles.list}>
      {facts.map((m) => (
        <View key={m.id} style={styles.factCard}>
          <Text style={styles.factContent}>{m.content}</Text>
          <View style={styles.meta}><SourceBadge source={m.source} /><Text style={styles.conf}>置信度 {(m.confidence * 100).toFixed(0)}%</Text></View>
        </View>
      ))}
    </View>
  );
}

function InferencesList({ inferences }: { inferences: MemoryItem[] }) {
  return (
    <View style={styles.list}>
      {inferences.map((m) => (
        <View key={m.id} style={[styles.inferCard, m.confidence < 0.7 && styles.inferLow]}>
          <Text style={styles.inferContent}>{m.inference || m.content}</Text>
          <View style={styles.meta}><SourceBadge source={m.source} /><Text style={styles.conf}>{m.confidence >= 0.8 ? "🟢" : m.confidence >= 0.6 ? "🟡" : "🔴"} {(m.confidence * 100).toFixed(0)}%</Text></View>
        </View>
      ))}
    </View>
  );
}

function EventsList({ events }: { events: MemoryItem[] }) {
  return (
    <View style={styles.list}>
      {events.map((m) => (
        <View key={m.id} style={styles.eventCard}>
          <Text style={styles.eventIcon}>⏰</Text>
          <View style={{ flex: 1 }}><Text style={styles.eventContent}>{m.content}</Text></View>
        </View>
      ))}
    </View>
  );
}

function SourceBadge({ source }: { source: string }) {
  const label = source === "user_stated" ? "他说" : source === "assistant_inferred" ? "她推测" : "系统";
  const color = source === "user_stated" ? "#4caf50" : source === "assistant_inferred" ? "#ff9800" : "#2196f3";
  return <View style={[styles.badge, { backgroundColor: color + "22", borderColor: color }]}><Text style={[styles.badgeText, { color }]}>{label}</Text></View>;
}

function MenuItem({ icon, label, subtitle }: { icon: any; label: string; subtitle?: string }) {
  return (
    <TouchableOpacity style={styles.menuItem} activeOpacity={0.6}>
      <Ionicons name={icon} size={22} color="#e91e63" style={{ marginRight: 12 }} />
      <View style={{ flex: 1 }}><Text style={styles.menuLabel}>{label}</Text>{subtitle ? <Text style={styles.menuSub}>{subtitle}</Text> : null}</View>
      <Ionicons name="chevron-forward" size={18} color="#555" />
    </TouchableOpacity>
  );
}

// ===== 样式 =====

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#12121a" },
  center: { flex: 1, backgroundColor: "#12121a", justifyContent: "center", alignItems: "center" },

  userCard: { alignItems: "center", paddingVertical: 20, backgroundColor: "#1a1a2e", marginBottom: 10 },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: "#2196f3", justifyContent: "center", alignItems: "center", marginBottom: 6 },
  avatarText: { fontSize: 26, fontWeight: "700", color: "#fff" },
  nickname: { fontSize: 18, fontWeight: "700", color: "#fff" },
  callName: { fontSize: 12, color: "#e91e63", marginTop: 2 },

  guide: { alignItems: "center", paddingVertical: 48, paddingHorizontal: 30 },
  guideIcon: { fontSize: 36, marginBottom: 10 },
  guideTitle: { fontSize: 16, fontWeight: "600", color: "#fff", marginBottom: 6 },
  guideText: { fontSize: 13, color: "#888", textAlign: "center", lineHeight: 20 },

  topTabs: { flexDirection: "row", paddingHorizontal: 14, marginBottom: 10, gap: 8 },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 20, backgroundColor: "#1e1e2e", alignItems: "center" },
  tabActive: { backgroundColor: "#e91e6322" },
  tabText: { fontSize: 14, color: "#888" },
  tabTextActive: { color: "#e91e63", fontWeight: "600" },

  subTabs: { flexDirection: "row", paddingHorizontal: 14, marginBottom: 10, gap: 6 },
  subTab: { flex: 1, paddingVertical: 6, borderRadius: 16, backgroundColor: "#1a1a2e", alignItems: "center" },
  subTabActive: { backgroundColor: "#333" },
  subTabText: { fontSize: 12, color: "#777" },
  subTabTextActive: { color: "#fff", fontWeight: "600" },

  list: { paddingHorizontal: 14 },
  factCard: { backgroundColor: "#1e1e2e", borderRadius: 12, padding: 12, marginBottom: 8 },
  factContent: { fontSize: 15, color: "#fff", lineHeight: 22 },
  inferCard: { backgroundColor: "#1e1e2e", borderRadius: 12, padding: 12, marginBottom: 8, borderLeftWidth: 3, borderLeftColor: "#ff9800" },
  inferLow: { borderLeftColor: "#666", opacity: 0.8 },
  inferContent: { fontSize: 14, color: "#ccc", lineHeight: 21 },
  eventCard: { flexDirection: "row", backgroundColor: "#1e1e2e", borderRadius: 12, padding: 12, marginBottom: 8, alignItems: "center", gap: 10 },
  eventIcon: { fontSize: 18 },
  eventContent: { fontSize: 15, color: "#fff" },
  meta: { flexDirection: "row", alignItems: "center", marginTop: 6, gap: 8 },
  badge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6, borderWidth: 1 },
  badgeText: { fontSize: 10, fontWeight: "600" },
  conf: { fontSize: 11, color: "#666" },

  overview: { paddingHorizontal: 14, marginBottom: 16 },
  overviewGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  stat: { flex: 1, minWidth: "45%", backgroundColor: "#1e1e2e", borderRadius: 12, padding: 14, alignItems: "center" },
  statValue: { fontSize: 24, fontWeight: "700", color: "#e91e63" },
  statLabel: { fontSize: 12, color: "#888", marginTop: 2 },

  section: { marginBottom: 16, paddingHorizontal: 14 },
  sectionTitle: { fontSize: 14, fontWeight: "600", color: "#999", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 },
  sectionHint: { fontSize: 11, color: "#555", marginBottom: 10, marginTop: -4 },

  diaryCard: { backgroundColor: "#1e1e2e", borderRadius: 14, padding: 14, marginBottom: 10, borderLeftWidth: 3, borderLeftColor: "#9c27b0" },
  diaryDate: { fontSize: 11, color: "#9c27b0", fontWeight: "600", marginBottom: 6 },
  diaryText: { fontSize: 14, color: "#ccc", lineHeight: 22, fontStyle: "italic" },

  tlItem: { flexDirection: "row", marginBottom: 12 },
  tlDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#e91e63", marginTop: 6, marginRight: 10 },
  tlCard: { flex: 1, backgroundColor: "#1e1e2e", borderRadius: 10, padding: 10 },
  tlDate: { fontSize: 10, color: "#e91e63", fontWeight: "600", marginBottom: 2 },
  tlTitle: { fontSize: 14, fontWeight: "600", color: "#fff", marginBottom: 2 },
  tlDesc: { fontSize: 12, color: "#999" },
  tlBadge: { fontSize: 9, color: "#9c27b0", marginTop: 4, fontWeight: "600" },

  menuSection: { marginTop: 8, paddingHorizontal: 14 },
  menuItem: { flexDirection: "row", alignItems: "center", backgroundColor: "#1e1e2e", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, marginBottom: 6 },
  menuLabel: { fontSize: 16, color: "#fff" },
  menuSub: { fontSize: 12, color: "#888", marginTop: 2 },
  footer: { textAlign: "center", color: "#555", fontSize: 12, paddingVertical: 24 },
});
