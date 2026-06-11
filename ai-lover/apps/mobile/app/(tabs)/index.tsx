import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator,
  TouchableOpacity, Alert, TextInput, Image, Modal,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { getCharacters, updateCustomName, uploadAvatar } from "../../src/services/api";
import { Character } from "../../src/types";

export default function DiscoverScreen() {
  const [jinceia, setJinceia] = useState<Character | null>(null);
  const [loading, setLoading] = useState(true);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [renameVisible, setRenameVisible] = useState(false);
  const [renameText, setRenameText] = useState("");

  const load = useCallback(() => {
    getCharacters()
      .then((data) => {
        if (data.characters.length > 0) {
          setJinceia(data.characters[0]);
          if (data.characters[0].avatar_url) {
            setAvatarUri(data.characters[0].avatar_url);
          }
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  // 改名
  const handleRename = () => {
    if (!jinceia) return;
    setRenameText(jinceia.custom_name || jinceia.name);
    setRenameVisible(true);
  };

  const confirmRename = async () => {
    if (!jinceia || !renameText.trim()) return;
    try {
      await updateCustomName(jinceia.id, renameText.trim());
      setJinceia({ ...jinceia, name: renameText.trim(), custom_name: renameText.trim() });
      setRenameVisible(false);
    } catch (e: any) {
      Alert.alert("失败", e.message || "改名失败");
    }
  };

  const resetName = async () => {
    if (!jinceia) return;
    try {
      await updateCustomName(jinceia.id, jinceia.default_name || "Jinceia");
      setJinceia({ ...jinceia, name: jinceia.default_name || "Jinceia", custom_name: null });
      setRenameVisible(false);
    } catch (e: any) {
      Alert.alert("失败", e.message || "操作失败");
    }
  };

  // 换头像
  const handleAvatar = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("需要权限", "请在设置中允许访问相册");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });

    if (result.canceled || !result.assets[0]?.base64) return;

    const base64 = result.assets[0].base64;
    const uri = result.assets[0].uri;

    try {
      const dataUrl = `data:image/jpeg;base64,${base64}`;
      await uploadAvatar(jinceia!.id, dataUrl);
      setAvatarUri(dataUrl);
      if (jinceia) setJinceia({ ...jinceia, avatar_url: dataUrl });
    } catch (e: any) {
      Alert.alert("上传失败", e.message || "请重试");
    }
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#e91e63" /></View>;
  }

  if (!jinceia) {
    return <View style={styles.center}><Text style={styles.emptyText}>加载失败</Text></View>;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      {/* 头像 + 名字 */}
      <View style={styles.heroSection}>
        <TouchableOpacity onPress={handleAvatar} activeOpacity={0.7}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>J</Text>
            </View>
          )}
          <View style={styles.editBadge}>
            <Text style={styles.editBadgeText}>📷</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity onPress={handleRename} activeOpacity={0.6}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{jinceia.name}</Text>
            <Text style={styles.editIcon}>✏️</Text>
          </View>
        </TouchableOpacity>
        <Text style={styles.nameHint}>点击名字修改 · 点击头像更换</Text>

        <Text style={styles.genderAge}>女性 · 25岁 · 年上御姐</Text>

        <View style={styles.tagsRow}>
          {jinceia.tags.map((tag) => (
            <View key={tag} style={styles.tag}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* 性格 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>性格</Text>
        <Text style={styles.sectionText}>{jinceia.personality}</Text>
      </View>

      {/* 背景故事 */}
      {jinceia.backstory && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>她的故事</Text>
          <Text style={styles.sectionText}>{jinceia.backstory}</Text>
        </View>
      )}

      {/* 互动风格 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>互动风格</Text>
        <View style={styles.styleGrid}>
          <StyleItem icon="💬" title="毒舌" desc="真心嫌弃你傻，不是撒娇" />
          <StyleItem icon="❤️" title="反差" desc="嘴上骂你，手上帮你" />
          <StyleItem icon="📚" title="知识型" desc="人文/历史/哲学/金融" />
          <StyleItem icon="🎭" title="会吃醋" desc="语气变冷，阴阳怪气" />
          <StyleItem icon="🌸" title="偶尔撒娇" desc="成熟女性的柔软时刻" />
          <StyleItem icon="🔥" title="会生气" desc="直接说「我在生气」" />
        </View>
      </View>

      <Text style={styles.footer}>去「聊天」Tab 开始和她对话吧</Text>

      {/* 改名 Modal */}
      <Modal visible={renameVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>修改名字</Text>
            <TextInput
              style={styles.modalInput}
              value={renameText}
              onChangeText={setRenameText}
              placeholder="输入新名字"
              placeholderTextColor="#555"
              maxLength={20}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalBtnSecondary} onPress={resetName}>
                <Text style={styles.modalBtnText2}>恢复默认</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtnSecondary} onPress={() => setRenameVisible(false)}>
                <Text style={styles.modalBtnText2}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtnPrimary} onPress={confirmRename}>
                <Text style={styles.modalBtnText1}>确定</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function StyleItem({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <View style={styles.styleItem}>
      <Text style={styles.styleIcon}>{icon}</Text>
      <Text style={styles.styleTitle}>{title}</Text>
      <Text style={styles.styleDesc}>{desc}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#12121a" },
  scroll: { paddingBottom: 40 },
  center: { flex: 1, backgroundColor: "#12121a", justifyContent: "center", alignItems: "center" },

  heroSection: { alignItems: "center", paddingVertical: 28, backgroundColor: "#1a1a2e", borderBottomLeftRadius: 24, borderBottomRightRadius: 24, marginBottom: 16 },

  avatar: { width: 80, height: 80, borderRadius: 40, marginBottom: 12 },
  avatarPlaceholder: { width: 80, height: 80, borderRadius: 40, backgroundColor: "#e91e63", justifyContent: "center", alignItems: "center", marginBottom: 12 },
  avatarText: { fontSize: 36, fontWeight: "800", color: "#fff" },
  editBadge: { position: "absolute", bottom: 8, right: -4, backgroundColor: "#1a1a2e", borderRadius: 12, width: 28, height: 28, justifyContent: "center", alignItems: "center", borderWidth: 2, borderColor: "#333" },
  editBadgeText: { fontSize: 14 },

  nameRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  name: { fontSize: 26, fontWeight: "700", color: "#fff" },
  editIcon: { fontSize: 16 },
  nameHint: { fontSize: 11, color: "#555", marginBottom: 8 },

  genderAge: { fontSize: 14, color: "#999", marginBottom: 14 },
  tagsRow: { flexDirection: "row", gap: 8, flexWrap: "wrap", justifyContent: "center" },
  tag: { backgroundColor: "#e91e6322", paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: "#e91e6344" },
  tagText: { color: "#e91e63", fontSize: 13, fontWeight: "600" },

  section: { paddingHorizontal: 16, marginBottom: 20 },
  sectionTitle: { fontSize: 13, fontWeight: "600", color: "#e91e63", marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 },
  sectionText: { color: "#bbb", fontSize: 14, lineHeight: 24, backgroundColor: "#1e1e2e", borderRadius: 14, padding: 16 },

  styleGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  styleItem: { width: "48%", backgroundColor: "#1e1e2e", borderRadius: 14, padding: 14, alignItems: "center" },
  styleIcon: { fontSize: 24, marginBottom: 6 },
  styleTitle: { fontSize: 15, fontWeight: "600", color: "#fff", marginBottom: 3 },
  styleDesc: { fontSize: 12, color: "#888", textAlign: "center" },

  emptyText: { color: "#999", fontSize: 16 },
  footer: { textAlign: "center", color: "#555", fontSize: 13, paddingVertical: 16 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", alignItems: "center", padding: 40 },
  modalCard: { backgroundColor: "#1e1e2e", borderRadius: 16, padding: 24, width: "100%", maxWidth: 320 },
  modalTitle: { color: "#fff", fontSize: 18, fontWeight: "600", marginBottom: 16, textAlign: "center" },
  modalInput: { backgroundColor: "#2a2a3e", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 16, color: "#fff", textAlign: "center", marginBottom: 16 },
  modalButtons: { flexDirection: "row", justifyContent: "flex-end", gap: 8 },
  modalBtnPrimary: { backgroundColor: "#e91e63", borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  modalBtnSecondary: { backgroundColor: "#333", borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  modalBtnText1: { color: "#fff", fontSize: 14, fontWeight: "600" },
  modalBtnText2: { color: "#aaa", fontSize: 14 },
});
