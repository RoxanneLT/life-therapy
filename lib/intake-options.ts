/**
 * Predefined intake assessment options — single source of truth
 * for both admin and portal UI.
 */

export interface IntakeOption {
  value: string;
  label: string;
}

export const BEHAVIOUR_OPTIONS: IntakeOption[] = [
  { value: "eating_problems", label: "Eating Problems" },
  { value: "suicidal_attempts", label: "Suicidal Attempts" },
  { value: "self_sabotage", label: "Self-Sabotage" },
  { value: "addictive_problems", label: "Addictive Problems" },
  { value: "compulsions", label: "Compulsions" },
  { value: "insomnia", label: "Insomnia" },
  { value: "low_self_esteem", label: "Low Self-Esteem" },
  { value: "negative_body_image", label: "Negative Body Image" },
  { value: "lack_of_motivation", label: "Lack of Motivation" },
  { value: "odd_behaviour", label: "Odd Behaviour" },
  { value: "isolation", label: "Isolation" },
  { value: "anxiety_stress", label: "Anxiety / Stress" },
  { value: "crying", label: "Crying" },
  { value: "procrastination", label: "Procrastination" },
  { value: "impulsive_reactions", label: "Impulsive Reactions" },
  { value: "hard_to_function", label: "Hard to Function" },
  { value: "emotional_outbursts", label: "Emotional Outbursts" },
  { value: "aggressive_behaviour", label: "Aggressive Behaviour" },
  { value: "toxic_relationships", label: "Toxic Relationships" },
  { value: "concentration_difficulties", label: "Concentration Difficulties" },
  { value: "phobic", label: "Phobic" },
  { value: "negative_thoughts", label: "Negative Thoughts" },
  { value: "overwhelming_fears", label: "Overwhelming Fears" },
  { value: "identity_confusion", label: "Identity Confusion" },
  { value: "avoidance", label: "Avoidance" },
];

export const FEELING_OPTIONS: IntakeOption[] = [
  { value: "sadness", label: "Sadness" },
  { value: "doubt", label: "Doubt" },
  { value: "anger", label: "Anger" },
  { value: "guilt", label: "Guilt" },
  { value: "annoyed", label: "Annoyed" },
  { value: "happy", label: "Happy" },
  { value: "bored", label: "Bored" },
  { value: "conflicted", label: "Conflicted" },
  { value: "confused", label: "Confused" },
  { value: "depressed", label: "Depressed" },
  { value: "regretful", label: "Regretful" },
  { value: "lonely", label: "Lonely" },
  { value: "hopeless", label: "Hopeless" },
  { value: "frustrated", label: "Frustrated" },
  { value: "stuck", label: "Stuck" },
  { value: "content", label: "Content" },
  { value: "excited", label: "Excited" },
  { value: "tense", label: "Tense" },
  { value: "jealous", label: "Jealous" },
  { value: "relaxed", label: "Relaxed" },
  { value: "energetic", label: "Energetic" },
  { value: "optimistic", label: "Optimistic" },
];

export const SYMPTOM_OPTIONS: IntakeOption[] = [
  { value: "headaches", label: "Headaches" },
  { value: "stomach_problems", label: "Stomach Problems" },
  { value: "skin_problems", label: "Skin Problems" },
  { value: "dizziness", label: "Dizziness" },
  { value: "dry_mouth", label: "Dry Mouth" },
  { value: "heart_palpitations", label: "Heart Palpitations" },
  { value: "fatigue", label: "Fatigue" },
  { value: "muscle_spasms", label: "Muscle Spasms" },
  { value: "nervous_twitches", label: "Nervous Twitches" },
  { value: "chest_pains", label: "Chest Pains" },
  { value: "tension", label: "Tension" },
  { value: "back_pain", label: "Back Pain" },
  { value: "unable_to_relax", label: "Unable to Relax" },
  { value: "fainting_spells", label: "Fainting Spells" },
  { value: "blackouts", label: "Blackouts" },
  { value: "hearing_things", label: "Hearing Things" },
  { value: "sweating", label: "Sweating" },
  { value: "tingling", label: "Tingling" },
  { value: "crying_physical", label: "Crying (Physical)" },
  { value: "scratching", label: "Scratching" },
  { value: "visual_disturbances", label: "Visual Disturbances" },
  { value: "numbness", label: "Numbness" },
];
