import * as Haptics from "expo-haptics";
import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface Props {
  visible: boolean;
  quote: string;
  onStay: () => void;
  onLeave: () => void;
}

export default function QuitWarningModal({ visible, quote, onStay, onLeave }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onStay}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.iconRing}>
            <Ionicons name="hourglass-outline" size={26} color="#FBBF24" />
          </View>
          <Text style={styles.title}>Leave now?</Text>
          <Text style={styles.quote}>{quote}</Text>

          <Pressable
            style={({ pressed }) => [styles.stayBtn, { opacity: pressed ? 0.88 : 1 }]}
            onPress={() => {
              Haptics.selectionAsync();
              onStay();
            }}
          >
            <Text style={styles.stayBtnTxt}>Keep going</Text>
          </Pressable>
          <Pressable style={styles.leaveBtn} onPress={onLeave}>
            <Text style={styles.leaveBtnTxt}>Exit anyway</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "#020617D0",
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
  },
  sheet: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "#13161F",
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "#1E2130",
    padding: 24,
    alignItems: "center",
  },
  iconRing: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: "#FBBF2420",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: "#F0F2F8",
    marginBottom: 10,
  },
  quote: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "#8892A4",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 22,
  },
  stayBtn: {
    width: "100%",
    backgroundColor: "#818CF8",
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: "center",
    marginBottom: 10,
  },
  stayBtnTxt: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  leaveBtn: {
    paddingVertical: 8,
  },
  leaveBtnTxt: {
    color: "#6B7A94",
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
});
