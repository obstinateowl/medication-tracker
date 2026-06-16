/** Stable MQTT / discovery object id: p{profileId}_m{medId} */
export function entityKey(profileId: number, medicationId: number): string {
  return `p${profileId}_m${medicationId}`;
}

export function discoveryObjectId(
  profileId: number,
  medicationId: number,
  suffix: string
): string {
  return `${entityKey(profileId, medicationId)}_${suffix}`;
}
