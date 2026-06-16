package com.procurement.platform.infrastructure;

import com.procurement.platform.domain.PlatformAnnouncement;
import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface PlatformAnnouncementMapper {

  @Select("""
      select id, title, content, audience, status, published_by, created_at
      from platform_announcements
      where status = 'active'
      order by created_at desc
      """)
  List<PlatformAnnouncement> listActive();

  @Select("""
      select id, title, content, audience, status, published_by, created_at
      from platform_announcements
      where status = 'active'
        and audience in (#{sharedAudience}, #{specificAudience})
      order by created_at desc
      """)
  List<PlatformAnnouncement> listActiveForAudiences(
      @Param("sharedAudience") String sharedAudience,
      @Param("specificAudience") String specificAudience);

  @Select("""
      select id, title, content, audience, status, published_by, created_at
      from platform_announcements
      where id = #{id}
      """)
  PlatformAnnouncement findById(@Param("id") String id);

  @Insert("""
      insert into platform_announcements (id, title, content, audience, status, published_by)
      values (#{id}, #{title}, #{content}, #{audience}, #{status}, #{publishedBy})
      """)
  void insert(
      @Param("id") String id,
      @Param("title") String title,
      @Param("content") String content,
      @Param("audience") String audience,
      @Param("status") String status,
      @Param("publishedBy") String publishedBy);
}
