import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { registerUser } from "../services/api";

interface Props {
  onComplete: () => void;
}

export default function OnboardingScreen({ onComplete }: Props) {
  const [nickname, setNickname] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleStart = async () => {
    const trimmed = nickname.trim();
    if (!trimmed) {
      setError("先告诉我你的名字吧");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await registerUser(trimmed);
      onComplete();
    } catch (err: any) {
      console.error("注册错误:", err);
      setError(`注册失败: ${err.message || "未知错误"}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* Jinceia 角色卡片 */}
        <View style={styles.heroCard}>
          <View style={styles.heroAvatar}>
            <Text style={styles.heroAvatarText}>J</Text>
          </View>
          <Text style={styles.heroName}>Jinceia</Text>
          <View style={styles.tagsRow}>
            {["御姐", "毒舌", "年上", "知识型"].map((tag) => (
              <View key={tag} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.heroDesc}>
            25岁，年上御姐。成熟理性，重度毒舌。{"\n"}
            嘴上一套手上一套——毒舌背后永远是关心。{"\n"}
            知识面极广，人文、历史、哲学、金融、心理学…
          </Text>
          <Text style={styles.heroQuote}>
            "她不会每天早安晚安。但你在深夜需要一个人说话的时候，她一定在。"
          </Text>
        </View>

        {/* 昵称输入 */}
        <View style={styles.inputCard}>
          <Text style={styles.inputLabel}>她该怎么称呼你？</Text>
          <Text style={styles.inputHint}>输入你的昵称，Jinceia 会用这个名字叫你</Text>
          <TextInput
            style={styles.input}
            value={nickname}
            onChangeText={(t) => { setNickname(t); setError(""); }}
            placeholder="你的昵称…"
            placeholderTextColor="#555"
            maxLength={20}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleStart}
          />
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>

        {/* 开始按钮 */}
        <TouchableOpacity
          style={[styles.startBtn, (!nickname.trim() || loading) && styles.startBtnDisabled]}
          onPress={handleStart}
          disabled={!nickname.trim() || loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.startBtnText}>开始聊天</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.footer}>你的数据只属于你，每个人都是独立的</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#12121a" },
  scroll: { alignItems: "center", paddingVertical: 40, paddingHorizontal: 20, flexGrow: 1 },

  // 角色卡片
  heroCard: {
    alignItems: "center",
    backgroundColor: "#1a1a2e",
    borderRadius: 20,
    padding: 24,
    width: "100%",
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#e91e6333",
  },
  heroAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#e91e63",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  heroAvatarText: { fontSize: 32, fontWeight: "800", color: "#fff" },
  heroName: { fontSize: 24, fontWeight: "700", color: "#fff", marginBottom: 8 },
  tagsRow: { flexDirection: "row", gap: 6, marginBottom: 14 },
  tag: {
    backgroundColor: "#e91e6322",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  tagText: { color: "#e91e63", fontSize: 12, fontWeight: "600" },
  heroDesc: {
    color: "#bbb",
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
    marginBottom: 16,
  },
  heroQuote: {
    color: "#e91e63",
    fontSize: 13,
    fontStyle: "italic",
    textAlign: "center",
    lineHeight: 20,
  },

  // 输入
  inputCard: { width: "100%", marginBottom: 24 },
  inputLabel: { color: "#fff", fontSize: 18, fontWeight: "600", marginBottom: 6, textAlign: "center" },
  inputHint: { color: "#888", fontSize: 13, textAlign: "center", marginBottom: 14 },
  input: {
    backgroundColor: "#2a2a3e",
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 14,
    fontSize: 17,
    color: "#fff",
    textAlign: "center",
  },
  errorText: { color: "#ff5252", fontSize: 13, textAlign: "center", marginTop: 8 },

  // 按钮
  startBtn: {
    backgroundColor: "#e91e63",
    borderRadius: 28,
    paddingVertical: 16,
    paddingHorizontal: 48,
    width: "100%",
    alignItems: "center",
    marginBottom: 16,
  },
  startBtnDisabled: { backgroundColor: "#333" },
  startBtnText: { color: "#fff", fontSize: 18, fontWeight: "700" },

  footer: { color: "#555", fontSize: 12, textAlign: "center" },
});
