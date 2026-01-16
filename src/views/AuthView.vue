<template>
  <div class="card column">
    <h2>Sign in</h2>
    <p class="muted">Login with Google to access your training data.</p>
    <button class="button" :disabled="auth.loading" @click="auth.signIn">
      Continue with Google
    </button>
  </div>
</template>

<script setup>
import { useAuthStore } from "../stores/auth";

const auth = useAuthStore();
</script>
