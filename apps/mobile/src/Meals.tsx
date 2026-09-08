import { useState } from "react";
import { ScrollView, View, Text, RefreshControl } from "react-native";
import { Coffee, Sun, Moon, CheckCircle2 } from "lucide-react-native";
import type { StudentMeals } from "@messmate/types";
import { addDays } from "@messmate/shared";
import { api, useAuth } from "./auth";
import { useRemote } from "./useRemote";
import { Button, Card, Badge, Busy, ErrorNotice } from "./ui";
import { styles as s, colors } from "./theme";
export function Meals({ dashboard = false }: { dashboard?: boolean }) {
  const [date, setDate] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const remote = useRemote<StudentMeals>(
    "/student/meals" + (date ? "?date=" + date : ""),
  );
  const { user } = useAuth();
  const data = remote.data;
  return (
    <ScrollView
      contentContainerStyle={s.content}
      refreshControl={
        <RefreshControl
          refreshing={remote.loading}
          onRefresh={() => void remote.reload()}
          tintColor={colors.green}
        />
      }
    >
      <Text style={s.eyebrow}>
        {dashboard ? "YOUR CAMPUS, CONNECTED" : "PLAN YOUR MEALS"}
      </Text>
      <Text style={s.title}>
        {dashboard
          ? `Hello, ${user?.name.split(" ")[0]}.`
          : "Joining us for a meal?"}
      </Text>
      <Text style={s.body}>
        {dashboard
          ? "Make today a little more thoughtful."
          : "Let the kitchen know before the cutoff."}
      </Text>
      <ErrorNotice message={error || remote.error} />
      {message && (
        <View style={s.notice} accessibilityLiveRegion="polite">
          <Text style={{ color: colors.green }}>{message}</Text>
        </View>
      )}
      {remote.loading && !data ? (
        <Busy />
      ) : (
        data && (
          <>
            <View style={s.between}>
              <Badge text={data.date} />
              <Text style={{ color: colors.muted, fontSize: 11 }}>
                Asia/Kolkata
              </Text>
            </View>
            <Button
              secondary
              title={date ? "Show today" : "Plan tomorrow"}
              onPress={() => {
                setDate(date ? "" : addDays(data.date, 1));
                setMessage("");
              }}
            />
            {dashboard && (
              <View style={[s.card, { backgroundColor: colors.lime }]}>
                <Text style={s.heading}>Your day at a glance</Text>
                <View style={s.between}>
                  <View>
                    <Text style={s.metric}>
                      {data.meals.filter((m) => m.response).length} / 3
                    </Text>
                    <Text style={s.body}>Meal plans saved</Text>
                  </View>
                  <View>
                    <Text style={s.metric}>
                      {data.meals.filter((m) => m.present).length}
                    </Text>
                    <Text style={s.body}>Meals attended</Text>
                  </View>
                </View>
              </View>
            )}
            {data.windows.map((w, i) => {
              const meal = data.meals.find((m) => m.meal === w.meal)!;
              const Icon = [Coffee, Sun, Moon][i];
              return (
                <Card key={w.meal}>
                  <View style={s.between}>
                    <Icon size={23} color={colors.green} />
                    <Badge
                      text={meal.closed ? "CUTOFF PASSED" : "OPEN FOR PLANNING"}
                    />
                  </View>
                  <Text style={s.heading}>
                    {w.meal[0] + w.meal.slice(1).toLowerCase()}
                  </Text>
                  <Text style={s.body}>
                    {w.start_time}–{w.end_time} · respond by {w.cutoff_time}
                  </Text>
                  <View style={s.row}>
                    {(["COMING", "NOT_COMING"] as const).map((response) => (
                      <Button
                        key={response}
                        style={{ flex: 1 }}
                        title={
                          response === "COMING" ? "I am coming" : "Not coming"
                        }
                        secondary={meal.response !== response}
                        disabled={meal.closed || busy}
                        onPress={() => {
                          setBusy(true);
                          setError("");
                          setMessage("");
                          api
                            .request("/student/meals", {
                              method: "PUT",
                              body: { date: data.date, meal: w.meal, response },
                            })
                            .then(async () => {
                              await remote.reload();
                              setMessage("Your meal preference is saved.");
                            })
                            .catch((e) =>
                              setError(
                                e instanceof Error
                                  ? e.message
                                  : "Could not save.",
                              ),
                            )
                            .finally(() => setBusy(false));
                        }}
                      />
                    ))}
                  </View>
                  <View style={s.divider} />
                  <View style={s.row}>
                    <CheckCircle2
                      size={15}
                      color={meal.present ? colors.green : colors.muted}
                    />
                    <Text style={s.body}>
                      {meal.present
                        ? "Attendance recorded"
                        : "No check-in recorded"}
                    </Text>
                  </View>
                </Card>
              );
            })}
          </>
        )
      )}
      {remote.error && (
        <Button
          secondary
          title="Retry connection"
          onPress={() => void remote.reload()}
        />
      )}
    </ScrollView>
  );
}
