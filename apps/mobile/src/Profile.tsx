import { ScrollView, Text, View, Alert, RefreshControl } from "react-native";
import type { Student } from "@messmate/types";
import { useRemote } from "./useRemote";
import { useAuth } from "./auth";
import { Button, Card, Badge, Busy, ErrorNotice } from "./ui";
import { styles as s } from "./theme";
export function Profile() {
  const remote = useRemote<Student>("/student/profile");
  return (
    <ScrollView
      contentContainerStyle={s.content}
      refreshControl={
        <RefreshControl refreshing={remote.loading} onRefresh={() => void remote.reload()} />
      }
    >
      <Text style={s.eyebrow}>YOUR CAMPUS IDENTITY</Text>
      <Text style={s.title}>Your profile</Text>
      <ErrorNotice message={remote.error} />
      {remote.loading ? (
        <Busy />
      ) : (
        remote.data && (
          <Card>
            <Text style={s.heading}>{remote.data.name}</Text>
            <Badge text={remote.data.status} />
            {[
              ["Student ID", remote.data.student_id],
              ["Email", remote.data.email],
              ["Registration", remote.data.registration_number],
              ["Hostel", remote.data.hostel],
              ["Room", remote.data.room_number],
              [
                "Fingerprint",
                remote.data.fingerprint_id
                  ? `ID ${remote.data.fingerprint_id}`
                  : "Not assigned",
              ],
            ].map(([label, value]) => (
              <View key={label}>
                <Text style={s.label}>{label}</Text>
                <Text style={s.body}>{value}</Text>
              </View>
            ))}
          </Card>
        )
      )}
      <Text style={s.body}>
        Your mess scanner sends attendance to the same account shown here. Pull
        down to refresh your fingerprint ID, or open Attendance history to see
        recorded check-ins. Contact your mess administrator to change assignments.
      </Text>
    </ScrollView>
  );
}
export function Settings() {
  const auth = useAuth();
  return (
    <ScrollView contentContainerStyle={s.content}>
      <Text style={s.eyebrow}>PREFERENCES & ACCESS</Text>
      <Text style={s.title}>App settings</Text>
      <Card>
        <Text style={s.heading}>Meal reminders</Text>
        <Text style={s.body}>
          Meal deadlines appear on your dashboard. This release does not send
          push notifications.
        </Text>
      </Card>
      <Card>
        <Text style={s.heading}>Time and privacy</Text>
        <Text style={s.body}>
          All meal times use Asia/Kolkata. Your session is stored in your
          device's secure storage. Fingerprint templates stay on the dining hall
          sensor.
        </Text>
        <Text style={s.body}>MessMate 1.0.0 · Student app</Text>
      </Card>
      <Button
        secondary
        title="Refresh account"
        onPress={() => void auth.refresh()}
      />
      <Button
        title="Sign out"
        onPress={() =>
          Alert.alert(
            "Sign out of MessMate?",
            "You will need to sign in again.",
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Sign out",
                style: "destructive",
                onPress: () => {
                  void auth
                    .logout()
                    .catch(() =>
                      Alert.alert(
                        "Signed out on this device",
                        "The server could not be reached. Your remote session will expire automatically.",
                      ),
                    );
                },
              },
            ],
          )
        }
      />
      <ErrorNotice message={auth.error} />
    </ScrollView>
  );
}
