package com.alcohol_tracker.bootsplash;

import android.app.Activity;
import androidx.annotation.Nullable;

public class BootSplash {

  public static void init(@Nullable final Activity activity) {
    BootSplashModule.init(activity);
  }
}
