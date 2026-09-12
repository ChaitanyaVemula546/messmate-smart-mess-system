import { useState } from "react";
import { ScrollView, View, Text, RefreshControl } from "react-native";
import type { Page, HistoryRow } from "@messmate/types";
import { useRemote } from "./useRemote";
import { Button, Card, Badge, Busy, ErrorNotice } from "./ui";
import { styles as s } from "./theme";
export function History() {
  const [p, setP] = useState(1),
    [attendanceOnly, setAttendanceOnly] = useState(false);
  const remote = useRemote<Page<HistoryRow>>(
    `/student/history?page=${p}&kind=${attendanceOnly ? "attendance" : "all"}`,
  );
  return (
    <ScrollView
      contentContainerStyle={s.content}
      refreshControl={
        <RefreshControl
          refreshing={remote.loading}
          onRefresh={() => void remote.reload()}
        />
      }
    >
      <Text style={s.eyebrow}>YOUR RECORD</Text>
      <Text style={s.title}>
        {attendanceOnly ? "Attendance history" : "Meal history"}
      </Text>
      <Text style={s.body}>Your plans and recorded arrivals in one place.</Text>
      <View style={s.row}>
        <Button
          style={{ flex: 1 }}
          secondary={!attendanceOnly}
          title="Attendance"
          onPress={() => {
            setAttendanceOnly(true);
            setP(1);
          }}
        />
        <Button
          style={{ flex: 1 }}
          secondary={attendanceOnly}
          title="All meals"
          onPress={() => {
            setAttendanceOnly(false);
            setP(1);
          }}
        />
      </View>
      <ErrorNotice message={remote.error} />
      {remote.loading ? (
        <Busy />
      ) : (
        remote.data && (
          <>
            {!remote.data.items.length && (
              <Text style={s.body}>
                No records yet. Your meal history will appear here.
              </Text>
            )}
            {remote.data.items.map((row) => (
              <Card key={row.date + row.meal}>
                <View style={s.between}>
                  <Text style={s.heading}>
                    {row.meal[0] + row.meal.slice(1).toLowerCase()}
                  </Text>
                  <Badge text={row.present ? "ATTENDED" : "NO CHECK-IN"} />
                </View>
                <Text style={s.body}>
                  {row.date} ·{" "}
                  {row.response === "COMING"
                    ? "Planned to attend"
                    : row.response === "NOT_COMING"
                      ? "Not planned"
                      : "No response"}
                </Text>
                {row.present && (
                  <Text style={s.body}>
                    {row.source === "IMPORT"
                      ? "Imported history · original time unavailable"
                      : new Date(row.check_in_time!).toLocaleString("en-IN", {
                          timeZone: "Asia/Kolkata",
                          dateStyle: "medium",
                          timeStyle: "short",
                        }) + " IST"}
                  </Text>
                )}
                {row.source === "FINGERPRINT" && (
                  <Text style={s.body}>Fingerprint check-in</Text>
                )}
              </Card>
            ))}
            <View style={s.between}>
              <Button
                secondary
                title="Previous"
                disabled={p === 1}
                onPress={() => setP(p - 1)}
              />
              <Text style={s.body}>Page {p}</Text>
              <Button
                secondary
                title="Next"
                disabled={p * remote.data.pageSize >= remote.data.total}
                onPress={() => setP(p + 1)}
              />
            </View>
          </>
        )
      )}
      {remote.error && (
        <Button title="Retry" onPress={() => void remote.reload()} />
      )}
    </ScrollView>
  );
}
