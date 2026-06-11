import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { getStoredUserId } from "../src/services/api";
import OnboardingScreen from "../src/screens/onboarding";

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);

  useEffect(() => {
    checkRegistration();
  }, []);

  const checkRegistration = async () => {
    try {
      const userId = await getStoredUserId();
      setIsRegistered(!!userId);
    } catch {
      // AsyncStorage 读取失败，当作未注册
    } finally {
      setIsReady(true);
    }
  };

  // 加载中
  if (!isReady) {
    return (
      <View style={{ flex: 1, backgroundColor: "#12121a", justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#e91e63" />
      </View>
    );
  }

  // 未注册 → 显示引导页
  if (!isRegistered) {
    return (
      <>
        <StatusBar style="light" />
        <OnboardingScreen onComplete={() => setIsRegistered(true)} />
      </>
    );
  }

  // 已注册 → 正常应用
  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
